import { describe, expect, it } from "vitest";
import { renderLeadFacts, renderServiceCatalog } from "./prompts";
import type { OutreachGenerationInput } from "./AIProvider";

function baseInput(overrides: Partial<OutreachGenerationInput["lead"]> = {}): OutreachGenerationInput {
  return {
    lead: {
      businessName: "Acme Coaching",
      category: "coaching",
      city: "Patna",
      website: null,
      websiteAudited: false,
      ...overrides,
    },
    websiteAudit: null,
    analysis: null,
    tenantServices: [],
    tone: "professional",
    language: "en",
    campaignObjective: "test",
  };
}

describe("renderLeadFacts — the anti-fabrication grounding", () => {
  it("states plainly that there is no website when none exists", () => {
    const facts = renderLeadFacts(baseInput({ website: null }));
    expect(facts).toContain("none found");
    expect(facts).not.toContain("score");
  });

  it("never leaks audit details when a website exists but wasn't audited", () => {
    const input = baseInput({ website: "https://example.com", websiteAudited: false });
    const facts = renderLeadFacts(input);
    expect(facts).toContain("NOT YET AUDITED");
    expect(facts).not.toMatch(/score|strength|problem|opportunit/i);
  });

  it("includes audit findings only when websiteAudited is true and audit data is provided", () => {
    const input: OutreachGenerationInput = {
      ...baseInput({ website: "https://example.com", websiteAudited: true }),
      websiteAudit: {
        url: "https://example.com",
        reachable: true,
        hasHttps: true,
        score: 42,
        strengths: ["Uses HTTPS"],
        problems: ["No meta description"],
        opportunities: ["Add a meta description"],
        performanceHints: { responseTimeMs: 300 },
        seoFindings: { hasTitle: true, hasMetaDescription: false, hasViewportMeta: true },
        socialLinksFound: [],
      },
    };
    const facts = renderLeadFacts(input);
    expect(facts).toContain("42/100");
    expect(facts).toContain("Uses HTTPS");
    expect(facts).toContain("No meta description");
  });

  it("marks an unreachable audited website as unreachable rather than scoring it", () => {
    const input: OutreachGenerationInput = {
      ...baseInput({ website: "https://dead.example.com", websiteAudited: true }),
      websiteAudit: {
        url: "https://dead.example.com",
        reachable: false,
        hasHttps: null,
        score: null,
        strengths: [],
        problems: ["Website did not respond"],
        opportunities: [],
        performanceHints: { responseTimeMs: null },
        seoFindings: { hasTitle: false, hasMetaDescription: false, hasViewportMeta: false },
        socialLinksFound: [],
      },
    };
    const facts = renderLeadFacts(input);
    expect(facts).toMatch(/did not respond/);
    expect(facts).not.toContain("/100");
  });
});

describe("renderServiceCatalog", () => {
  it("tells the model to leave the recommendation null when no services are configured", () => {
    expect(renderServiceCatalog([])).toMatch(/leave recommendedServiceId.*null/i);
  });

  it("lists each service with its real id so the model can only recommend a real one", () => {
    const catalog = renderServiceCatalog([
      {
        id: "svc-1",
        name: "Website Development",
        description: "Custom websites",
        targetIndustries: ["coaching"],
        painPoints: ["no website"],
        pitchAngles: ["missed leads"],
      },
    ]);
    expect(catalog).toContain("id: svc-1");
    expect(catalog).toContain("Website Development");
  });
});
