import type { Lead, WebsiteAudit } from "@virtelon/db";
import type { SocialProfilesJson } from "../presence-research";

export type ScoringWeights = Record<string, number>;
export type ScoreBreakdown = Record<string, number>;

export interface ScoreInput {
  lead: Pick<Lead, "website" | "businessStatus" | "rating" | "reviewCount" | "phone" | "email" | "category" | "lastEnrichedAt">;
  websiteAudit: Pick<WebsiteAudit, "reachable" | "score"> | null;
  socialProfiles: SocialProfilesJson;
  /** One string array per active ServiceOffering.targetIndustries. Empty when
   * the tenant hasn't configured any offerings yet — categoryFit stays
   * neutral rather than penalizing every lead for missing tenant config. */
  targetIndustries: string[][];
}

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
  priority: "low" | "medium" | "high";
}

type SignalFn = (input: ScoreInput) => number;

/**
 * Five signals, each a plain rule over data we actually have today (no AI
 * involved yet — that's Phase 4's job, layered on top of this). Every
 * signal is 0-100 and documented so a tenant reading their own lead's
 * breakdown can see exactly why it scored the way it did.
 */
const SIGNALS: Record<string, SignalFn> = {
  // No website = the biggest, clearest opportunity this product exists to
  // find. A reachable, well-audited site is the opposite — low opportunity.
  websiteOpportunity: ({ lead, websiteAudit }) => {
    if (!lead.website) return 100;
    if (!websiteAudit) return 50; // has a website but not audited yet
    if (!websiteAudit.reachable) return 90;
    if (websiteAudit.score === null) return 50;
    if (websiteAudit.score < 40) return 80;
    if (websiteAudit.score < 70) return 50;
    return 20;
  },

  // Google rating/review count as a proxy for "is this a real, established
  // business worth pursuing" — not a claim about their online presence.
  businessQuality: ({ lead }) => {
    if (lead.businessStatus === "CLOSED_PERMANENTLY") return 0;
    if (lead.rating === null) return 40;
    if (lead.rating >= 4.5 && (lead.reviewCount ?? 0) >= 50) return 100;
    if (lead.rating >= 4.0 && (lead.reviewCount ?? 0) >= 20) return 80;
    if (lead.rating >= 3.5) return 60;
    return 30;
  },

  // Mirrors websiteOpportunity but for social presence: a business with no
  // website AND no discoverable social profiles is effectively invisible
  // online — the clearest opportunity for a digital-presence pitch.
  onlinePresenceOpportunity: ({ lead, socialProfiles }) => {
    if (!lead.lastEnrichedAt) return 50; // not researched yet
    const count = Object.keys(socialProfiles).length;
    if (count === 0 && !lead.website) return 100;
    if (count === 0) return 70;
    if (count <= 2) return 50;
    return 20;
  },

  // Matches the lead's category against the tenant's configured
  // ServiceOffering target industries. Neutral (not penalized) when the
  // tenant hasn't configured any offerings yet.
  categoryFit: ({ lead, targetIndustries }) => {
    if (targetIndustries.length === 0) return 60;
    const category = lead.category.toLowerCase();
    const matches = targetIndustries.some((industries) =>
      industries.some((t) => category.includes(t.toLowerCase()) || t.toLowerCase().includes(category))
    );
    return matches ? 100 : 50;
  },

  // How reachable the lead actually is — a great lead with no phone or
  // email on file can't be acted on yet.
  contactability: ({ lead }) => {
    const hasPhone = Boolean(lead.phone);
    const hasEmail = Boolean(lead.email);
    if (hasPhone && hasEmail) return 100;
    if (hasPhone || hasEmail) return 70;
    return 20;
  },
};

/** Seed default — matches packages/db/src/seed.ts. Each tenant can override
 * via ScoringConfig.weights (see docs/ARCHITECTURE.md §8); any key not
 * recognized above falls back to a neutral 50 rather than throwing, so a
 * tenant experimenting with custom signal names never breaks scoring. */
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  websiteOpportunity: 30,
  businessQuality: 20,
  onlinePresenceOpportunity: 25,
  categoryFit: 15,
  contactability: 10,
};

export function computeLeadScore(input: ScoreInput, weights: ScoringWeights): ScoreResult {
  const breakdown: ScoreBreakdown = {};
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [signal, weight] of Object.entries(weights)) {
    if (weight <= 0) continue;
    const compute = SIGNALS[signal];
    const raw = compute ? compute(input) : 50;
    breakdown[signal] = raw;
    weightedSum += raw * weight;
    totalWeight += weight;
  }

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;
  const priority: ScoreResult["priority"] = score >= 75 ? "high" : score >= 45 ? "medium" : "low";
  return { score, breakdown, priority };
}
