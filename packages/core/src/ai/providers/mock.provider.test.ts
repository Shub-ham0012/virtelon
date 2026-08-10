import { describe, expect, it } from "vitest";
import { MockAIProvider } from "./mock.provider";
import type { OutreachGenerationInput } from "../AIProvider";

const provider = new MockAIProvider();

function baseInput(overrides: Partial<OutreachGenerationInput> = {}): OutreachGenerationInput {
  return {
    lead: { businessName: "Acme Coaching", category: "coaching", city: "Patna", website: null, websiteAudited: false },
    websiteAudit: null,
    analysis: null,
    tenantServices: [],
    tone: "professional",
    language: "en",
    campaignObjective: "test",
    ...overrides,
  };
}

describe("MockAIProvider", () => {
  it("labels every output as mock", async () => {
    const analysis = await provider.analyzeLead(baseInput());
    expect(analysis.reasoning.some((r) => r.includes("MOCK"))).toBe(true);

    const message = await provider.generateOutreach(baseInput());
    expect(message).toContain("MOCK");
  });

  it("scores a lead with no website higher than one with a decent website", async () => {
    const noWebsite = await provider.analyzeLead(baseInput({ lead: { businessName: "A", category: "gym", website: null, websiteAudited: false } }));
    const goodWebsite = await provider.analyzeLead(
      baseInput({
        lead: { businessName: "B", category: "gym", website: "https://b.com", websiteAudited: true },
        websiteAudit: {
          url: "https://b.com",
          reachable: true,
          hasHttps: true,
          score: 85,
          strengths: [],
          problems: [],
          opportunities: [],
          performanceHints: { responseTimeMs: 200 },
          seoFindings: { hasTitle: true, hasMetaDescription: true, hasViewportMeta: true },
          socialLinksFound: [],
        },
      })
    );
    expect(noWebsite.score).toBeGreaterThan(goodWebsite.score);
  });

  it("never recommends a service that isn't in the catalog it was given", async () => {
    const services = [
      { id: "svc-1", name: "Website Development", description: "", targetIndustries: [], painPoints: [], pitchAngles: [] },
    ];
    const analysis = await provider.analyzeLead(baseInput({ tenantServices: services }));
    expect(analysis.recommendedServiceId).toBe("svc-1");
  });

  it("leaves the recommendation null when no services are configured", async () => {
    const analysis = await provider.analyzeLead(baseInput({ tenantServices: [] }));
    expect(analysis.recommendedServiceId).toBeNull();
  });
});
