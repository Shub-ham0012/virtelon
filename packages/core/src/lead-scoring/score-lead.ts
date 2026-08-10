import type { TenantScopedClient } from "@virtelon/db";
import type { SocialProfilesJson } from "../presence-research";
import { computeLeadScore, DEFAULT_SCORING_WEIGHTS, type ScoreResult, type ScoringWeights } from "./scoring-engine";

/** Computes and persists a lead's score: writes a new LeadScore row (full
 * history, tagged with the config version that produced it) and updates
 * Lead.leadScore (the fast-to-query current value used for sorting/filtering). */
export async function scoreLead(db: TenantScopedClient, leadId: string): Promise<ScoreResult> {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  const websiteAudit = await db.websiteAudit.findUnique({ where: { leadId } });
  const scoringConfig = await db.scoringConfig.findFirst({ where: {} });
  const offerings = await db.serviceOffering.findMany({ where: { isActive: true } });

  const weights: ScoringWeights = (scoringConfig?.weights as ScoringWeights | undefined) ?? DEFAULT_SCORING_WEIGHTS;
  const configVersion = scoringConfig?.version ?? 1;

  const result = computeLeadScore(
    {
      lead,
      websiteAudit,
      socialProfiles: (lead.socialProfiles as SocialProfilesJson | null) ?? {},
      targetIndustries: offerings.map((o) => o.targetIndustries),
    },
    weights
  );

  await db.leadScore.create({
    data: { leadId, score: result.score, breakdown: result.breakdown, configVersion },
  });
  await db.lead.update({ where: { id: leadId }, data: { leadScore: result.score } });

  return result;
}

/** Scores several leads in sequence — e.g. every lead from one discovery
 * search or CSV import. Sequential rather than parallel on purpose: each
 * call does its own small set of reads/writes against the same tenant, and
 * Phase 7's background workers are the right place for real batch
 * throughput once volume actually needs it. */
export async function scoreLeads(db: TenantScopedClient, leadIds: string[]): Promise<void> {
  for (const leadId of leadIds) {
    await scoreLead(db, leadId);
  }
}
