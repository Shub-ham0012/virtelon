import type { AIProvider, LeadAnalysis, OutreachGenerationInput } from "../AIProvider";

/** Deterministic, clearly-labeled fake output — no network call, no API key.
 * Every result is honest about being a mock so it's never confusable with a
 * real analysis anywhere downstream (UI, exports, CRM notes). */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";
  readonly modelId = "mock";

  async analyzeLead(input: OutreachGenerationInput): Promise<LeadAnalysis> {
    const hasWebsite = Boolean(input.lead.website);
    const auditScore = input.websiteAudit?.score ?? null;
    const score = !hasWebsite ? 85 : auditScore !== null && auditScore < 50 ? 75 : 55;
    const bestService = input.tenantServices[0] ?? null;

    return {
      score,
      priority: score >= 75 ? "high" : score >= 45 ? "medium" : "low",
      reasoning: [
        "[MOCK] No ANTHROPIC_API_KEY configured — this is deterministic sample output, not a real analysis.",
        hasWebsite ? "Business has an existing website on record." : "Business has no website on record.",
      ],
      painPoints: hasWebsite
        ? ["Website may not be converting visitors as well as it could"]
        : ["No website — the business has no owned online presence"],
      opportunities: hasWebsite ? ["Website refresh / conversion improvements"] : ["New website build"],
      recommendedServiceId: bestService?.id ?? null,
      recommendedService: bestService?.name ?? null,
      recommendedPitchAngle: bestService
        ? `Lead with ${bestService.name.toLowerCase()} given the gap identified above.`
        : null,
    };
  }

  async generateOutreach(input: OutreachGenerationInput): Promise<string> {
    return `[MOCK MESSAGE — no ANTHROPIC_API_KEY configured] Hi, this is a sample ${input.tone} outreach message for ${input.lead.businessName}. Configure ANTHROPIC_API_KEY to generate real, personalized messages.`;
  }

  async generateFollowUp(
    input: OutreachGenerationInput & { previousMessage: string; stepIndex: number }
  ): Promise<string> {
    return `[MOCK FOLLOW-UP #${input.stepIndex} — no ANTHROPIC_API_KEY configured] Following up with ${input.lead.businessName}.`;
  }

  async summarizeConversation(messages: string[]): Promise<string> {
    return `[MOCK SUMMARY — no ANTHROPIC_API_KEY configured] ${messages.length} message(s) exchanged.`;
  }
}
