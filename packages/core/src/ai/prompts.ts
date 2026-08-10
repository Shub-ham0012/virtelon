import type { OutreachGenerationInput, ServiceOfferingSummary } from "./AIProvider";

/**
 * Renders exactly the verified facts about a lead — nothing more. This is
 * the actual enforcement mechanism behind "the AI must not fabricate facts"
 * (product spec §9): if `websiteAudited` is false, no audit detail is ever
 * rendered into the prompt, so there is nothing for the model to embellish.
 */
export function renderLeadFacts(input: OutreachGenerationInput): string {
  const lines: string[] = [];
  lines.push(`Business name: ${input.lead.businessName}`);
  lines.push(`Category: ${input.lead.category}`);
  if (input.lead.city) lines.push(`Location: ${input.lead.city}`);

  if (!input.lead.website) {
    lines.push("Website: none found. This business has no website — do not imply otherwise.");
  } else if (!input.lead.websiteAudited) {
    lines.push(
      `Website: ${input.lead.website} — NOT YET AUDITED. You may note that a website exists; you must not describe its quality, content, speed, or any technical detail, since none of that has been checked.`
    );
  } else if (input.websiteAudit) {
    const a = input.websiteAudit;
    lines.push(`Website: ${a.url}`);
    lines.push(`Website reachable: ${a.reachable ? "yes" : "no — it did not respond when checked"}`);
    if (a.reachable) {
      lines.push(`Website score: ${a.score ?? "unknown"}/100`);
      if (a.strengths.length > 0) lines.push(`Website strengths (verified): ${a.strengths.join("; ")}`);
      if (a.problems.length > 0) lines.push(`Website problems (verified): ${a.problems.join("; ")}`);
      if (a.opportunities.length > 0) lines.push(`Website opportunities (verified): ${a.opportunities.join("; ")}`);
    }
  }

  return lines.join("\n");
}

export function renderServiceCatalog(services: ServiceOfferingSummary[]): string {
  if (services.length === 0) {
    return "No services are configured yet. Leave recommendedServiceId and recommendedService null — do not invent a service.";
  }
  return services
    .map(
      (s) =>
        `- id: ${s.id}\n  name: ${s.name}\n  description: ${s.description}\n  pain points it addresses: ${
          s.painPoints.join(", ") || "none listed"
        }\n  pitch angles: ${s.pitchAngles.join(", ") || "none listed"}`
    )
    .join("\n");
}

export const ANALYSIS_SYSTEM_PROMPT = `You are a B2B sales analyst for an IT/digital services agency. You score inbound business leads and identify concrete opportunities to pitch.

Ground every claim in the facts you are given. Never invent, assume, or infer any detail about a business's website, reviews, or operations beyond what is explicitly stated. If a website was not audited, you may only note that it exists — never speculate about its quality.

recommendedServiceId, when set, MUST be exactly one of the id values listed in the services catalog. If no service in the catalog is a good fit, or no catalog was provided, set recommendedServiceId to null — you may still set recommendedService to a short free-text label describing a generic opportunity, but never claim it maps to a specific configured service that doesn't fit.`;

export const OUTREACH_SYSTEM_PROMPT = `You write short, specific, non-generic first-touch outreach messages for an IT/digital services agency reaching out to local businesses.

Use ONLY the facts provided — never claim to have checked something that wasn't checked, never invent details about the business. Avoid generic templates like "Hi sir, we are a digital marketing company..." — instead reference one or two specific, true details about the business. Keep it short (3-5 sentences), natural, and non-salesy. Match the requested tone and language exactly. End with a soft, low-pressure call to action, not a hard sell.

Return ONLY the message text — no preamble, no explanation, no surrounding quotes.`;

export const FOLLOW_UP_SYSTEM_PROMPT = `You write short follow-up messages for an IT/digital services agency, continuing a first-touch outreach that received no reply.

Use ONLY the facts and the previous message provided — never invent new details. Do not repeat the first message verbatim; add a small new angle or a gentle nudge. Keep it even shorter than a first message (2-3 sentences). If this is explicitly marked as a final follow-up, close gracefully and leave the door open rather than pushing harder.

Return ONLY the message text — no preamble, no explanation, no surrounding quotes.`;

export const CONVERSATION_SUMMARY_SYSTEM_PROMPT = `Summarize this conversation between a sales rep and a prospective business lead in 2-3 sentences, capturing intent, sentiment, and any next steps. Do not add information not present in the conversation.`;

export function buildAnalysisPrompt(input: OutreachGenerationInput): string {
  return [
    "Analyze this business as a sales lead using ONLY the verified facts below.",
    "",
    "## Business facts",
    renderLeadFacts(input),
    "",
    "## Our services catalog (recommend from this list only, or leave the recommendation null)",
    renderServiceCatalog(input.tenantServices),
    "",
    `Campaign objective: ${input.campaignObjective}`,
  ].join("\n");
}

export function buildOutreachPrompt(input: OutreachGenerationInput): string {
  const lines = [
    "Write a personalized first-touch outreach message for this business.",
    "",
    "## Business facts (use only these — do not invent anything else)",
    renderLeadFacts(input),
    "",
  ];

  if (input.analysis) {
    lines.push("## Prior analysis (context only — still ground the message solely in the verified facts above)");
    lines.push(`Pain points identified: ${input.analysis.painPoints.join("; ") || "none"}`);
    lines.push(`Opportunities identified: ${input.analysis.opportunities.join("; ") || "none"}`);
    if (input.analysis.recommendedPitchAngle) {
      lines.push(`Suggested pitch angle: ${input.analysis.recommendedPitchAngle}`);
    }
    lines.push("");
  }

  lines.push("## Our services catalog");
  lines.push(renderServiceCatalog(input.tenantServices));
  lines.push("");
  lines.push(`Campaign objective: ${input.campaignObjective}`);
  lines.push(`Tone: ${input.tone}`);
  lines.push(`Language: ${input.language}`);

  return lines.join("\n");
}

export function buildFollowUpPrompt(
  input: OutreachGenerationInput & { previousMessage: string; stepIndex: number }
): string {
  return [
    "Write a follow-up outreach message for this business — the first message below received no reply.",
    "",
    "## Business facts (use only these — do not invent anything else)",
    renderLeadFacts(input),
    "",
    `## Previous message (step ${input.stepIndex})`,
    input.previousMessage,
    "",
    `Tone: ${input.tone}`,
    `Language: ${input.language}`,
  ].join("\n");
}
