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

// "gemini-flash-latest" is a stable alias Google keeps pointed at whatever
// their current flash model is — verified live against the real API before
// writing this (a dated model name like "gemini-2.5-flash" was already
// returning 404 "no longer available to new users" as of Aug 2026; the
// generic aliases were the ones that still worked). Using the alias avoids
// this file rotting the next time Google retires a dated model version.
const MODEL_ID = "gemini-flash-latest";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const ANALYSIS_JSON_SHAPE = `Respond with ONLY a JSON object (no markdown code fences, no commentary before or after) matching exactly this shape:
{
  "score": <number, 0-100>,
  "priority": "low" | "medium" | "high",
  "reasoning": [<string>, ...]  (at least one entry),
  "painPoints": [<string>, ...],
  "opportunities": [<string>, ...],
  "recommendedServiceId": <string, or null>,
  "recommendedService": <string, or null>,
  "recommendedPitchAngle": <string, or null>
}`;

interface GeminiPart {
  text?: string;
}
interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
  finishReason?: string;
}
interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
}

/**
 * Free-tier alternative to ClaudeAIProvider — a Google AI Studio API key
 * (aistudio.google.com) works here without a billing account attached,
 * unlike Anthropic's API or Google's other Cloud APIs (Places, Custom
 * Search). Same prompts, same interface, same anti-fabrication grounding —
 * see packages/core/src/ai/prompts.ts — just a different model behind it.
 */
export class GeminiAIProvider implements AIProvider {
  readonly name = "gemini";
  readonly modelId = MODEL_ID;

  constructor(private readonly apiKey: string) {}

  private async generate(systemInstruction: string, userText: string, jsonMode = false): Promise<string> {
    const response = await fetch(`${API_BASE}/${MODEL_ID}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts: [{ text: userText }] }],
        ...(jsonMode ? { generationConfig: { responseMimeType: "application/json" } } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini request failed: ${response.status} ${response.statusText} — ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as GeminiResponse;
    if (data.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked the request: ${data.promptFeedback.blockReason}`);
    }
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) {
      throw new Error(`Gemini did not return message text (finishReason: ${candidate?.finishReason ?? "unknown"})`);
    }
    return text;
  }

  async analyzeLead(input: OutreachGenerationInput): Promise<LeadAnalysis> {
    const text = await this.generate(`${ANALYSIS_SYSTEM_PROMPT}\n\n${ANALYSIS_JSON_SHAPE}`, buildAnalysisPrompt(input), true);

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error("Gemini did not return valid JSON for lead analysis");
    }
    const parsed = LeadAnalysisSchema.parse(raw);

    // Same rule as ClaudeAIProvider — never trust a model-supplied service id
    // at face value, only accept it if it matches the catalog we sent.
    const validServiceIds = new Set(input.tenantServices.map((s) => s.id));
    return {
      ...parsed,
      recommendedServiceId:
        parsed.recommendedServiceId && validServiceIds.has(parsed.recommendedServiceId) ? parsed.recommendedServiceId : null,
    };
  }

  async generateOutreach(input: OutreachGenerationInput): Promise<string> {
    return this.generate(OUTREACH_SYSTEM_PROMPT, buildOutreachPrompt(input));
  }

  async generateFollowUp(input: OutreachGenerationInput & { previousMessage: string; stepIndex: number }): Promise<string> {
    return this.generate(FOLLOW_UP_SYSTEM_PROMPT, buildFollowUpPrompt(input));
  }

  async summarizeConversation(messages: string[]): Promise<string> {
    const transcript = messages.map((m, i) => `[${i % 2 === 0 ? "Us" : "Them"}]: ${m}`).join("\n");
    return this.generate(CONVERSATION_SUMMARY_SYSTEM_PROMPT, transcript);
  }
}
