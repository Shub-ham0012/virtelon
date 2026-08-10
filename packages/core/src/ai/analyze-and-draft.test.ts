import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rawPrisma, createTenantScopedClient } from "@virtelon/db";
import { analyzeAndDraftForLead } from "./analyze-and-draft";
import { MockAIProvider } from "./providers/mock.provider";
import { createServiceOffering } from "../offerings/service-offering";

/** Integration test — runs against a real Postgres database (DATABASE_URL). */

const runId = Math.random().toString(36).slice(2, 8);
const provider = new MockAIProvider();

let org: { id: string };
let leadWithWebsite: { id: string };
let leadWithoutWebsite: { id: string };

beforeAll(async () => {
  org = await rawPrisma.organization.create({ data: { name: `AI Test ${runId}`, slug: `ai-test-${runId}` } });
  const source = await rawPrisma.leadSource.create({ data: { organizationId: org.id, type: "manual_entry", config: {} } });

  leadWithWebsite = await rawPrisma.lead.create({
    data: {
      organizationId: org.id,
      sourceId: source.id,
      businessName: "Website Business",
      category: "gym",
      website: "https://example.com",
      dedupHash: `hash-web-${runId}`,
    },
  });
  await rawPrisma.websiteAudit.create({
    data: {
      leadId: leadWithWebsite.id,
      url: "https://example.com",
      reachable: true,
      hasHttps: true,
      score: 40,
      strengths: ["Uses HTTPS"],
      problems: ["Missing meta description"],
      opportunities: ["Add a meta description"],
    },
  });

  leadWithoutWebsite = await rawPrisma.lead.create({
    data: {
      organizationId: org.id,
      sourceId: source.id,
      businessName: "No Website Business",
      category: "salon",
      dedupHash: `hash-noweb-${runId}`,
    },
  });
});

afterAll(async () => {
  await rawPrisma.organization.delete({ where: { id: org.id } });
  await rawPrisma.$disconnect();
});

describe("analyzeAndDraftForLead", () => {
  it("persists an AIAnalysis row with the analysis and a draft message", async () => {
    const db = createTenantScopedClient(org.id);
    const result = await analyzeAndDraftForLead(db, provider, leadWithoutWebsite.id, {
      tone: "professional",
      language: "en",
    });

    expect(result.draftMessage).toContain("No Website Business");
    expect(result.analysis.score).toBeGreaterThan(0);

    const stored = await db.aIAnalysis.findUnique({ where: { id: result.aiAnalysisId } });
    expect(stored?.draftMessage).toBe(result.draftMessage);
    expect(stored?.draftTone).toBe("professional");
    expect(stored?.provider).toBe("mock");
  });

  it("passes real audit data through so a leaad with a poor website scores as an opportunity", async () => {
    const db = createTenantScopedClient(org.id);
    const result = await analyzeAndDraftForLead(db, provider, leadWithWebsite.id, {
      tone: "friendly",
      language: "en",
    });
    // MockAIProvider scores a bad (score < 50) audited website as a high opportunity too.
    expect(result.analysis.score).toBeGreaterThanOrEqual(70);
  });

  it("only recommends a service the tenant actually configured", async () => {
    const db = createTenantScopedClient(org.id);
    const offering = await createServiceOffering(db, org.id, {
      name: "Website Development",
      description: "Custom websites for local businesses",
      targetIndustries: ["salon"],
      targetBusinessTypes: [],
      painPoints: ["no website"],
      pitchAngles: ["missed leads"],
      portfolioUrls: [],
    });

    const result = await analyzeAndDraftForLead(db, provider, leadWithoutWebsite.id, {
      tone: "professional",
      language: "en",
    });

    expect(result.analysis.recommendedServiceId).toBe(offering.id);
  });

  it("writes an Activity entry recording the analysis", async () => {
    const db = createTenantScopedClient(org.id);
    await analyzeAndDraftForLead(db, provider, leadWithoutWebsite.id, { tone: "concise", language: "en" });

    const activities = await db.activity.findMany({ where: { leadId: leadWithoutWebsite.id, type: "ai_analysis" } });
    expect(activities.length).toBeGreaterThan(0);
  });
});
