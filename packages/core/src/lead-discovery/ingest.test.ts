import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rawPrisma, createTenantScopedClient } from "@virtelon/db";
import { ingestDiscoveredLeads } from "./ingest";
import { getOrCreateLeadSource } from "./get-or-create-source";
import type { DiscoveredLead } from "./LeadDiscoveryProvider";

/** Integration test — runs against a real Postgres database (DATABASE_URL). */

const runId = Math.random().toString(36).slice(2, 8);
let org: { id: string };

beforeAll(async () => {
  org = await rawPrisma.organization.create({ data: { name: `Ingest Test ${runId}`, slug: `ingest-test-${runId}` } });
});

afterAll(async () => {
  await rawPrisma.organization.delete({ where: { id: org.id } });
  await rawPrisma.$disconnect();
});

function lead(overrides: Partial<DiscoveredLead> = {}): DiscoveredLead {
  return {
    externalId: `ext-${runId}-1`,
    source: "mock",
    businessName: "Acme Coaching",
    category: "coaching",
    phone: "9876543210",
    city: "Patna",
    raw: {},
    ...overrides,
  };
}

describe("ingestDiscoveredLeads", () => {
  it("creates a new lead on first ingest", async () => {
    const db = createTenantScopedClient(org.id);
    const source = await getOrCreateLeadSource(db, org.id, "mock");

    const result = await ingestDiscoveredLeads(db, { organizationId: org.id, sourceId: source.id, defaultCountry: "IN" }, [
      lead(),
    ]);

    expect(result.createdCount).toBe(1);
    expect(result.duplicateCount).toBe(0);
    expect(result.updatedCount).toBe(0);

    const stored = await db.lead.findUnique({ where: { id: result.leadIds[0] } });
    expect(stored?.businessName).toBe("Acme Coaching");
    expect(stored?.phoneE164).toBe("+919876543210");
    expect(stored?.dedupHash).toBeTruthy();
  });

  it("updates (not duplicates) when the same externalId is ingested again", async () => {
    const db = createTenantScopedClient(org.id);
    const source = await getOrCreateLeadSource(db, org.id, "mock");
    const ctx = { organizationId: org.id, sourceId: source.id, defaultCountry: "IN" };
    // Distinct business identity from the "creates a new lead" test above —
    // otherwise the dedupHash fallback (correctly) treats them as the same
    // real business and this test would never reach the externalId path.
    const distinctLead = (overrides: Partial<DiscoveredLead> = {}) =>
      lead({ businessName: "Beta Fitness Studio", phone: "9222222222", ...overrides });

    await ingestDiscoveredLeads(db, ctx, [distinctLead({ externalId: `ext-${runId}-2`, rating: 4.0 })]);
    const second = await ingestDiscoveredLeads(db, ctx, [distinctLead({ externalId: `ext-${runId}-2`, rating: 4.8 })]);

    expect(second.createdCount).toBe(0);
    expect(second.updatedCount).toBe(1);

    const stored = await db.lead.findUnique({ where: { id: second.leadIds[0] } });
    expect(stored?.rating).toBe(4.8);
  });

  it("marks a differently-sourced but same-business lead as a duplicate via dedupHash", async () => {
    const db = createTenantScopedClient(org.id);
    const source = await getOrCreateLeadSource(db, org.id, "mock");
    const ctx = { organizationId: org.id, sourceId: source.id, defaultCountry: "IN" };

    await ingestDiscoveredLeads(db, ctx, [
      lead({ externalId: `ext-${runId}-3a`, businessName: "Same Business", phone: "9111111111" }),
    ]);
    const result = await ingestDiscoveredLeads(db, ctx, [
      lead({ externalId: `ext-${runId}-3b`, businessName: "Same Business", phone: "9111111111" }),
    ]);

    expect(result.createdCount).toBe(0);
    expect(result.duplicateCount).toBe(1);
  });

  it("does not leak leads across tenants", async () => {
    const otherOrg = await rawPrisma.organization.create({ data: { name: `Other ${runId}`, slug: `other-${runId}` } });
    const dbOther = createTenantScopedClient(otherOrg.id);
    const sourceOther = await getOrCreateLeadSource(dbOther, otherOrg.id, "mock");

    await ingestDiscoveredLeads(
      dbOther,
      { organizationId: otherOrg.id, sourceId: sourceOther.id, defaultCountry: "IN" },
      [lead({ externalId: `ext-${runId}-4`, businessName: "Other Org Business" })]
    );

    const db = createTenantScopedClient(org.id);
    const found = await db.lead.findMany({ where: { businessName: "Other Org Business" } });
    expect(found).toHaveLength(0);

    await rawPrisma.organization.delete({ where: { id: otherOrg.id } });
  });
});
