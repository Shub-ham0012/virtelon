import type { TenantScopedClient } from "@virtelon/db";
import type { WebsiteAuditResult } from "../website-audit";
import { toAISummary } from "../offerings/to-ai-summary";
import type { AIProvider, LeadAnalysis, OutreachGenerationInput, OutreachLanguage, OutreachTone } from "./AIProvider";

const DEFAULT_CAMPAIGN_OBJECTIVE =
  "Introduce our services and identify one specific, honest opportunity to help this business improve its online presence.";

export interface DraftGenerationOptions {
  tone: OutreachTone;
  language: OutreachLanguage;
  campaignObjective?: string;
}

export interface DraftGenerationResult {
  analysis: LeadAnalysis;
  draftMessage: string;
  aiAnalysisId: string;
}

/**
 * The single orchestration point every UI action and future job calls:
 * builds the grounded AIProvider input from real DB rows (never inventing
 * data itself), runs analyzeLead() then generateOutreach() using that
 * analysis as context, and persists one AIAnalysis row carrying both.
 */
export async function analyzeAndDraftForLead(
  db: TenantScopedClient,
  provider: AIProvider,
  leadId: string,
  options: DraftGenerationOptions
): Promise<DraftGenerationResult> {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  const auditRow = await db.websiteAudit.findUnique({ where: { leadId } });
  const offerings = await db.serviceOffering.findMany({ where: { isActive: true } });

  const websiteAudit: WebsiteAuditResult | null = auditRow
    ? {
        url: auditRow.url,
        reachable: auditRow.reachable,
        hasHttps: auditRow.hasHttps,
        score: auditRow.score,
        strengths: auditRow.strengths,
        problems: auditRow.problems,
        opportunities: auditRow.opportunities,
        performanceHints: (auditRow.performanceHints as { responseTimeMs: number | null } | null) ?? {
          responseTimeMs: null,
        },
        seoFindings: (auditRow.seoFindings as {
          hasTitle: boolean;
          hasMetaDescription: boolean;
          hasViewportMeta: boolean;
        } | null) ?? { hasTitle: false, hasMetaDescription: false, hasViewportMeta: false },
        socialLinksFound: [],
      }
    : null;

  const baseInput: OutreachGenerationInput = {
    lead: {
      businessName: lead.businessName,
      category: lead.category,
      city: lead.city,
      website: lead.website,
      websiteAudited: auditRow !== null,
    },
    websiteAudit,
    analysis: null,
    tenantServices: offerings.map(toAISummary),
    tone: options.tone,
    language: options.language,
    campaignObjective: options.campaignObjective ?? DEFAULT_CAMPAIGN_OBJECTIVE,
  };

  const analysis = await provider.analyzeLead(baseInput);
  const draftMessage = await provider.generateOutreach({ ...baseInput, analysis });

  const aiAnalysis = await db.aIAnalysis.create({
    data: {
      leadId,
      provider: provider.name,
      model: provider.modelId,
      score: analysis.score,
      priority: analysis.priority,
      reasoning: analysis.reasoning,
      painPoints: analysis.painPoints,
      opportunities: analysis.opportunities,
      recommendedServiceId: analysis.recommendedServiceId,
      recommendedService: analysis.recommendedService,
      recommendedPitch: analysis.recommendedPitchAngle,
      rawResponse: analysis,
      validated: true,
      draftMessage,
      draftTone: options.tone,
      draftLanguage: options.language,
    },
  });

  await db.activity.create({
    data: {
      leadId,
      type: "ai_analysis",
      content: `AI analysis generated (score ${analysis.score}, priority ${analysis.priority}) with a draft outreach message.`,
      metadata: { provider: provider.name, model: provider.modelId },
    },
  });

  return { analysis, draftMessage, aiAnalysisId: aiAnalysis.id };
}
