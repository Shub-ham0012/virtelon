import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { LeadAnalysisSchema, type AIProvider, type LeadAnalysis, type OutreachGenerationInput } from "../AIProvider";
import {
  ANALYSIS_SYSTEM_PROMPT,
  CONVERSATION_SUMMARY_SYSTEM_PROMPT,
  FOLLOW_UP_SYSTEM_PROMPT,
  OUTREACH_SYSTEM_PROMPT,
  buildAnalysisPrompt,
  buildFollowUpPrompt,
  buildOutreachPrompt,
} from "../prompts";

// Structured analysis needs headroom for adaptive thinking + the JSON output
// (Claude Opus 5 thinks by default and max_tokens caps thinking + response
// together). Copywriting is a lighter task, so it runs at a lower effort.
const MODEL_ID = "claude-opus-5";
const ANALYSIS_MAX_TOKENS = 4096;
const MESSAGE_MAX_TOKENS = 3072;

function extractText(response: Anthropic.Message): string {
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock || !textBlock.text.trim()) {
    throw new Error(
      `Claude did not return message text (stop_reason: ${response.stop_reason}). ` +
        "If stop_reason is 'refusal', the request was declined by safety classifiers."
    );
  }
  return textBlock.text.trim();
}

export class ClaudeAIProvider implements AIProvider {
  readonly name = "claude";
  readonly modelId = MODEL_ID;
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async analyzeLead(input: OutreachGenerationInput): Promise<LeadAnalysis> {
    const response = await this.client.messages.parse({
      model: MODEL_ID,
      max_tokens: ANALYSIS_MAX_TOKENS,
      system: ANALYSIS_SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(LeadAnalysisSchema) },
      messages: [{ role: "user", content: buildAnalysisPrompt(input) }],
    });

    if (!response.parsed_output) {
      throw new Error(`Claude did not return a parseable lead analysis (stop_reason: ${response.stop_reason})`);
    }

    // Never trust a model-supplied id at face value — only accept it if it
    // actually matches a service in the catalog we sent (see AIProvider.ts).
    const validServiceIds = new Set(input.tenantServices.map((s) => s.id));
    const parsed = response.parsed_output;
    return {
      ...parsed,
      recommendedServiceId:
        parsed.recommendedServiceId && validServiceIds.has(parsed.recommendedServiceId)
          ? parsed.recommendedServiceId
          : null,
    };
  }

  async generateOutreach(input: OutreachGenerationInput): Promise<string> {
    const response = await this.client.messages.create({
      model: MODEL_ID,
      max_tokens: MESSAGE_MAX_TOKENS,
      system: OUTREACH_SYSTEM_PROMPT,
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: buildOutreachPrompt(input) }],
    });
    return extractText(response);
  }

  async generateFollowUp(
    input: OutreachGenerationInput & { previousMessage: string; stepIndex: number }
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: MODEL_ID,
      max_tokens: MESSAGE_MAX_TOKENS,
      system: FOLLOW_UP_SYSTEM_PROMPT,
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: buildFollowUpPrompt(input) }],
    });
    return extractText(response);
  }

  async summarizeConversation(messages: string[]): Promise<string> {
    const transcript = messages.map((m, i) => `[${i % 2 === 0 ? "Us" : "Them"}]: ${m}`).join("\n");
    const response = await this.client.messages.create({
      model: MODEL_ID,
      max_tokens: 1024,
      system: CONVERSATION_SUMMARY_SYSTEM_PROMPT,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: transcript }],
    });
    return extractText(response);
  }
}
