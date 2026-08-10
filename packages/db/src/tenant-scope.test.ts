import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rawPrisma } from "./client";
import { createTenantScopedClient } from "./tenant-scope";

/**
 * These are integration tests — they run against a real Postgres database
 * (DATABASE_URL) because tenant isolation is exactly the kind of property
 * that's easy to get wrong in ways a mocked client would never catch.
 */

const runId = Math.random().toString(36).slice(2, 8);

let orgA: { id: string };
let orgB: { id: string };
let sourceA: { id: string };
let sourceB: { id: string };
let leadA: { id: string };
let leadB: { id: string };

beforeAll(async () => {
  orgA = await rawPrisma.organization.create({ data: { name: `Org A ${runId}`, slug: `org-a-${runId}` } });
  orgB = await rawPrisma.organization.create({ data: { name: `Org B ${runId}`, slug: `org-b-${runId}` } });

  sourceA = await rawPrisma.leadSource.create({
    data: { organizationId: orgA.id, type: "manual_entry", config: {} },
  });
  sourceB = await rawPrisma.leadSource.create({
    data: { organizationId: orgB.id, type: "manual_entry", config: {} },
  });

  leadA = await rawPrisma.lead.create({
    data: {
      organizationId: orgA.id,
      sourceId: sourceA.id,
      businessName: "Org A Business",
      category: "coaching",
      dedupHash: `hash-a-${runId}`,
    },
  });
  leadB = await rawPrisma.lead.create({
    data: {
      organizationId: orgB.id,
      sourceId: sourceB.id,
      businessName: "Org B Business",
      category: "coaching",
      dedupHash: `hash-b-${runId}`,
    },
  });
});

afterAll(async () => {
  await rawPrisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  await rawPrisma.$disconnect();
});

describe("direct-model tenant scoping (Lead)", () => {
  it("findMany only returns the calling tenant's rows", async () => {
    const dbA = createTenantScopedClient(orgA.id);
    const leads = await dbA.lead.findMany({});
    expect(leads.map((l) => l.id)).toContain(leadA.id);
    expect(leads.map((l) => l.id)).not.toContain(leadB.id);
  });

  it("findUnique cannot read another tenant's row by id", async () => {
    const dbA = createTenantScopedClient(orgA.id);
    const found = await dbA.lead.findUnique({ where: { id: leadB.id } });
    expect(found).toBeNull();
  });

  it("create always stamps the caller's organizationId, even if the caller forges another", async () => {
    const dbA = createTenantScopedClient(orgA.id);
    const forged = await dbA.lead.create({
      data: {
        // intentionally forging organizationId here to prove the extension overwrites it
        organizationId: orgB.id,
        sourceId: sourceA.id,
        businessName: "Forged Lead",
        category: "coaching",
        dedupHash: `hash-forged-${runId}`,
      },
    });
    expect(forged.organizationId).toBe(orgA.id);
  });

  it("update cannot mutate another tenant's row", async () => {
    const dbA = createTenantScopedClient(orgA.id);
    await expect(
      dbA.lead.update({ where: { id: leadB.id }, data: { businessName: "Hacked" } })
    ).rejects.toThrow();

    const stillIntact = await rawPrisma.lead.findUnique({ where: { id: leadB.id } });
    expect(stillIntact?.businessName).toBe("Org B Business");
  });
});

describe("nested-model tenant scoping (Contact, via Lead)", () => {
  it("scopes a child model through its parent relation", async () => {
    const contactA = await rawPrisma.contact.create({ data: { leadId: leadA.id, name: "A Contact" } });
    const contactB = await rawPrisma.contact.create({ data: { leadId: leadB.id, name: "B Contact" } });

    const dbA = createTenantScopedClient(orgA.id);
    const found = await dbA.contact.findMany({});
    expect(found.map((c) => c.id)).toContain(contactA.id);
    expect(found.map((c) => c.id)).not.toContain(contactB.id);

    const crossTenantRead = await dbA.contact.findUnique({ where: { id: contactB.id } });
    expect(crossTenantRead).toBeNull();
  });
});

describe("self-scoped Organization model", () => {
  it("always resolves to the caller's own organization, even if another id is passed", async () => {
    const dbA = createTenantScopedClient(orgA.id);
    const updated = await dbA.organization.update({
      where: { id: orgB.id }, // forged — should be overridden to orgA.id
      data: { name: "Renamed via tenant client" },
    });
    expect(updated.id).toBe(orgA.id);

    const orgBUnchanged = await rawPrisma.organization.findUnique({ where: { id: orgB.id } });
    expect(orgBUnchanged?.name).toBe(`Org B ${runId}`);
  });

  it("rejects operations outside the read/update allowlist", async () => {
    const dbA = createTenantScopedClient(orgA.id);
    await expect(dbA.organization.delete({ where: { id: orgA.id } })).rejects.toThrow();
  });
});

describe("fail-closed for unmapped models", () => {
  it("throws rather than silently returning unscoped data", async () => {
    const dbA = createTenantScopedClient(orgA.id);
    // User is deliberately excluded from both scoping maps — this is a
    // runtime guard, not a type error, since the model still exists on the
    // underlying client.
    await expect(dbA.user.findMany({})).rejects.toThrow(/no tenant-scoping rule/);
  });
});
