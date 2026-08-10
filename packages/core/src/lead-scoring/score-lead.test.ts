import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rawPrisma, createTenantScopedClient } from "@virtelon/db";
import { scoreLead } from "./score-lead";

/** Integration test — runs against a real Postgres database (DATABASE_URL). */

const runId = Math.random().toString(36).slice(2, 8);
let org: { id: string };
let source: { id: string };

beforeAll(async () => {
  org = await rawPrisma.organization.create({ data: { name: `Score Test ${runId}`, slug: `score-test-${runId}` } });
  source = await rawPrisma.leadSource.create({ data: { organizationId: org.id, type: "manual_entry", config: {} } });
});

afterAll(async () => {
  await rawPrisma.organization.delete({ where: { id: org.id } });
  await rawPrisma.$disconnect();
});

describe("scoreLead", () => {
  it("uses the default weights and persists both LeadScore history and Lead.leadScore", async () => {
    const db = createTenantScopedClient(org.id);
    const lead = await rawPrisma.lead.create({
      data: {
        organizationId: org.id,
        sourceId: source.id,
        businessName: "No Website Coaching Co",
        category: "coaching",
        dedupHash: `hash-${runId}-1`,
      },
    });

    const result = await scoreLead(db, lead.id);
    expect(result.score).toBeGreaterThan(0);
    expect(result.breakdown.websiteOpportunity).toBe(100); // no website

    const stored = await rawPrisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(stored.leadScore).toBe(result.score);

    const history = await rawPrisma.leadScore.findMany({ where: { leadId: lead.id } });
    expect(history).toHaveLength(1);
    expect(history[0]?.score).toBe(result.score);
  });

  it("respects a tenant-specific ScoringConfig instead of the default weights", async () => {
    await rawPrisma.scoringConfig.create({
      data: { organizationId: org.id, weights: { contactability: 100 }, threshold: 70 },
    });
    const db = createTenantScopedClient(org.id);
    const lead = await rawPrisma.lead.create({
      data: {
        organizationId: org.id,
        sourceId: source.id,
        businessName: "Reachable Business",
        category: "gym",
        phone: "+919876543210",
        email: "hello@example.com",
        dedupHash: `hash-${runId}-2`,
      },
    });

    const result = await scoreLead(db, lead.id);
    // With ONLY contactability weighted, and both phone+email present, score should be 100.
    expect(result.score).toBe(100);
    expect(Object.keys(result.breakdown)).toEqual(["contactability"]);
  });

  it("factors in an active ServiceOffering's target industries for categoryFit", async () => {
    const otherOrg = await rawPrisma.organization.create({ data: { name: `Score Test Offerings ${runId}`, slug: `score-test-off-${runId}` } });
    const otherSource = await rawPrisma.leadSource.create({ data: { organizationId: otherOrg.id, type: "manual_entry", config: {} } });
    await rawPrisma.serviceOffering.create({
      data: {
        organizationId: otherOrg.id,
        name: "Salon Marketing",
        description: "test",
        targetIndustries: ["salon"],
      },
    });
    const db = createTenantScopedClient(otherOrg.id);
    const matchingLead = await rawPrisma.lead.create({
      data: { organizationId: otherOrg.id, sourceId: otherSource.id, businessName: "Glow Salon", category: "salon", dedupHash: `hash-${runId}-3` },
    });

    const result = await scoreLead(db, matchingLead.id);
    expect(result.breakdown.categoryFit).toBe(100);

    await rawPrisma.organization.delete({ where: { id: otherOrg.id } });
  });
});
