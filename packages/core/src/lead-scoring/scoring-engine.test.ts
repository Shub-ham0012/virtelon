import { describe, expect, it } from "vitest";
import { computeLeadScore, DEFAULT_SCORING_WEIGHTS, type ScoreInput } from "./scoring-engine";

function baseInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    lead: {
      website: null,
      businessStatus: null,
      rating: null,
      reviewCount: null,
      phone: null,
      email: null,
      category: "coaching",
      lastEnrichedAt: null,
    },
    websiteAudit: null,
    socialProfiles: {},
    targetIndustries: [],
    ...overrides,
  };
}

describe("computeLeadScore signals", () => {
  it("gives maximum websiteOpportunity when there's no website at all", () => {
    const { breakdown } = computeLeadScore(baseInput(), DEFAULT_SCORING_WEIGHTS);
    expect(breakdown.websiteOpportunity).toBe(100);
  });

  it("gives low websiteOpportunity for a reachable, well-audited site", () => {
    const input = baseInput({
      lead: { ...baseInput().lead, website: "https://example.com" },
      websiteAudit: { reachable: true, score: 90 },
    });
    expect(computeLeadScore(input, DEFAULT_SCORING_WEIGHTS).breakdown.websiteOpportunity).toBe(20);
  });

  it("treats an unreachable website as a near-maximum opportunity", () => {
    const input = baseInput({
      lead: { ...baseInput().lead, website: "https://example.com" },
      websiteAudit: { reachable: false, score: null },
    });
    expect(computeLeadScore(input, DEFAULT_SCORING_WEIGHTS).breakdown.websiteOpportunity).toBe(90);
  });

  it("zeroes businessQuality for a permanently closed business regardless of rating", () => {
    const input = baseInput({ lead: { ...baseInput().lead, businessStatus: "CLOSED_PERMANENTLY", rating: 4.9, reviewCount: 500 } });
    expect(computeLeadScore(input, DEFAULT_SCORING_WEIGHTS).breakdown.businessQuality).toBe(0);
  });

  it("rewards a high-rating, high-review-count business", () => {
    const input = baseInput({ lead: { ...baseInput().lead, rating: 4.8, reviewCount: 120 } });
    expect(computeLeadScore(input, DEFAULT_SCORING_WEIGHTS).breakdown.businessQuality).toBe(100);
  });

  it("keeps onlinePresenceOpportunity neutral until the lead has been researched", () => {
    const { breakdown } = computeLeadScore(baseInput(), DEFAULT_SCORING_WEIGHTS);
    expect(breakdown.onlinePresenceOpportunity).toBe(50);
  });

  it("maxes onlinePresenceOpportunity for a researched lead with no website and no social profiles", () => {
    const input = baseInput({ lead: { ...baseInput().lead, lastEnrichedAt: new Date() } });
    expect(computeLeadScore(input, DEFAULT_SCORING_WEIGHTS).breakdown.onlinePresenceOpportunity).toBe(100);
  });

  it("lowers onlinePresenceOpportunity once several social profiles are already known", () => {
    const input = baseInput({
      lead: { ...baseInput().lead, lastEnrichedAt: new Date() },
      socialProfiles: {
        instagram: { url: "https://instagram.com/x", confidence: "high", source: "website_extraction", checkedAt: "" },
        facebook: { url: "https://facebook.com/x", confidence: "high", source: "website_extraction", checkedAt: "" },
        linkedin: { url: "https://linkedin.com/x", confidence: "high", source: "website_extraction", checkedAt: "" },
      },
    });
    expect(computeLeadScore(input, DEFAULT_SCORING_WEIGHTS).breakdown.onlinePresenceOpportunity).toBe(20);
  });

  it("stays neutral on categoryFit when the tenant has no offerings configured", () => {
    const { breakdown } = computeLeadScore(baseInput(), DEFAULT_SCORING_WEIGHTS);
    expect(breakdown.categoryFit).toBe(60);
  });

  it("scores categoryFit highly when the lead's category matches a configured offering", () => {
    const input = baseInput({ targetIndustries: [["coaching", "gyms"]] });
    expect(computeLeadScore(input, DEFAULT_SCORING_WEIGHTS).breakdown.categoryFit).toBe(100);
  });

  it("scores categoryFit lower when the category doesn't match any configured offering", () => {
    const input = baseInput({ lead: { ...baseInput().lead, category: "restaurant" }, targetIndustries: [["coaching"]] });
    expect(computeLeadScore(input, DEFAULT_SCORING_WEIGHTS).breakdown.categoryFit).toBe(50);
  });

  it("scores contactability by phone/email presence", () => {
    expect(computeLeadScore(baseInput(), DEFAULT_SCORING_WEIGHTS).breakdown.contactability).toBe(20);
    expect(
      computeLeadScore(baseInput({ lead: { ...baseInput().lead, phone: "+919876543210" } }), DEFAULT_SCORING_WEIGHTS).breakdown.contactability
    ).toBe(70);
    expect(
      computeLeadScore(
        baseInput({ lead: { ...baseInput().lead, phone: "+919876543210", email: "a@b.com" } }),
        DEFAULT_SCORING_WEIGHTS
      ).breakdown.contactability
    ).toBe(100);
  });
});

describe("computeLeadScore weighting and priority", () => {
  it("computes a weighted average, not a simple sum", () => {
    // one signal at raw 100, one at raw 0, equal weight -> 50
    const input = baseInput({
      lead: { ...baseInput().lead, phone: "+919876543210", email: "a@b.com" }, // contactability = 100
    });
    const result = computeLeadScore(input, { contactability: 1, businessQuality: 1 }); // businessQuality (no rating) = 40
    expect(result.score).toBe(Math.round((100 + 40) / 2));
  });

  it("falls back to a neutral 50 for an unrecognized signal key rather than throwing", () => {
    expect(() => computeLeadScore(baseInput(), { totallyCustomSignal: 100 })).not.toThrow();
    expect(computeLeadScore(baseInput(), { totallyCustomSignal: 100 }).score).toBe(50);
  });

  it("ignores zero/negative weights", () => {
    const result = computeLeadScore(baseInput(), { contactability: 0, businessQuality: 1 });
    expect(result.breakdown.contactability).toBeUndefined();
    expect(result.breakdown.businessQuality).toBe(40);
  });

  it("defaults to a neutral score of 50 when no weights are configured", () => {
    expect(computeLeadScore(baseInput(), {}).score).toBe(50);
  });

  it("assigns priority bands consistently with the score", () => {
    expect(computeLeadScore(baseInput({ targetIndustries: [["coaching"]] }), { categoryFit: 1 }).priority).toBe("high"); // 100
    expect(computeLeadScore(baseInput(), { businessQuality: 1 }).priority).toBe("low"); // 40
  });
});
