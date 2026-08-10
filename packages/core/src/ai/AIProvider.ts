// zod/v4, not the classic top-level "zod" (v3) import used everywhere else
// in this codebase — @anthropic-ai/sdk's zodOutputFormat() (used in
// claude.provider.ts for structured output) requires a v4-shaped schema.
import { z } from "zod/v4";
import type { WebsiteAuditResult } from "../website-audit";

export const LeadAnalysisSchema = z.object({
  score: z.number().min(0).max(100),
  priority: z.enum(["low", "medium", "high"]),
  reasoning: z.array(z.string()).min(1),
  painPoints: z.array(z.string()),
  opportunities: z.array(z.string()),
  // Must be one of the ids in the ServiceOfferingSummary[] passed in — checked
  // and nulled out by the caller if the model hallucinates an id (see
  // ClaudeAIProvider.analyzeLead). recommendedService is the free-text label,
  // kept even when an id is set so the UI never needs a second lookup.
  recommendedServiceId: z.string().nullable(),
  recommendedService: z.string().nullable(),
  recommendedPitchAngle: z.string().nullable(),
});
export type LeadAnalysis = z.infer<typeof LeadAnalysisSchema>;

/** Slim projection of ServiceOffering — the AI gets exactly what it needs to
 * reason about fit, not the full CRM-facing record (price, portfolio URLs). */
export interface ServiceOfferingSummary {
  id: string;
  name: string;
  description: string;
  targetIndustries: string[];
  painPoints: string[];
  pitchAngles: string[];
}

export type OutreachTone = "formal" | "friendly" | "concise" | "professional" | "hinglish";
export type OutreachLanguage = "en" | "hi" | "hinglish";

export interface OutreachGenerationInput {
  lead: {
    businessName: string;
    category: string;
    city?: string | null;
    website?: string | null;
    /** Gate: the AI may only reference audit facts when this is true — enforced
     * structurally (see packages/core/src/ai/prompts.ts), not just by prompt wording. */
    websiteAudited: boolean;
  };
  websiteAudit?: WebsiteAuditResult | null;
  analysis?: LeadAnalysis | null;
  tenantServices: ServiceOfferingSummary[]; // tenant's own structured catalog — never hard-coded, never a bare string
  tone: OutreachTone;
  language: OutreachLanguage;
  campaignObjective: string;
}

export interface AIProvider {
  readonly name: string;
  readonly modelId: string;
  analyzeLead(input: OutreachGenerationInput): Promise<LeadAnalysis>;
  generateOutreach(input: OutreachGenerationInput): Promise<string>;
  generateFollowUp(input: OutreachGenerationInput & { previousMessage: string; stepIndex: number }): Promise<string>;
  summarizeConversation(messages: string[]): Promise<string>;
}
