import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rawPrisma, createTenantScopedClient } from "@virtelon/db";
import { addLeadsToCampaign, countCampaignLeads, createCampaign, listCampaignLeads, listCampaigns } from "./campaign";

const runId = Math.random().toString(36).slice(2, 8);
let org: { id: string };
let leadA: { id: string };
let leadB: { id: string };

beforeAll(async () => {
  org = await rawPrisma.organization.create({ data: { name: `Campaign Test ${runId}`, slug: `campaign-test-${runId}` } });
  const source = await rawPrisma.leadSource.create({ data: { organizationId: org.id, type: "manual_entry", config: {} } });
  leadA = await rawPrisma.lead.create({
    data: { organizationId: org.id, sourceId: source.id, businessName: "A", category: "gym", dedupHash: `h-a-${runId}` },
  });
  leadB = await rawPrisma.lead.create({
    data: { organizationId: org.id, sourceId: source.id, businessName: "B", category: "gym", dedupHash: `h-b-${runId}` },
  });
});

afterAll(async () => {
  await rawPrisma.organization.delete({ where: { id: org.id } });
  await rawPrisma.$disconnect();
});

describe("campaigns", () => {
  it("creates and lists a campaign scoped to the tenant", async () => {
    const db = createTenantScopedClient(org.id);
    await createCampaign(db, org.id, {
      name: "Pune Gyms",
      category: "gym",
      location: "Pune",
      serviceLabel: "Website Development",
      dailyLeadTarget: 20,
      minLeadScore: 70,
      messageTone: "professional",
      language: "en",
      mode: "APPROVAL_REQUIRED",
    });

    const campaigns = await listCampaigns(db);
    expect(campaigns).toHaveLength(1);
    expect(campaigns[0]?.name).toBe("Pune Gyms");
  });

  it("attaches leads to a campaign and is idempotent on re-attach", async () => {
    const db = createTenantScopedClient(org.id);
    const [campaign] = await listCampaigns(db);

    const firstAdded = await addLeadsToCampaign(db, campaign!.id, [leadA.id, leadB.id]);
    expect(firstAdded).toBe(2);

    // Re-running discovery for the same campaign shouldn't duplicate or error.
    const secondAdded = await addLeadsToCampaign(db, campaign!.id, [leadA.id]);
    expect(secondAdded).toBe(0);

    const count = await countCampaignLeads(db, campaign!.id);
    expect(count).toBe(2);
  });

  it("lists the actual lead records attached to a campaign", async () => {
    const db = createTenantScopedClient(org.id);
    const [campaign] = await listCampaigns(db);

    const leads = await listCampaignLeads(db, campaign!.id);
    expect(leads.map((l) => l.businessName).sort()).toEqual(["A", "B"]);
  });

  it("does not leak another tenant's campaign leads", async () => {
    const otherOrg = await rawPrisma.organization.create({ data: { name: `Other ${runId}`, slug: `other-camp-${runId}` } });
    const dbOther = createTenantScopedClient(otherOrg.id);
    const [campaign] = await listCampaigns(createTenantScopedClient(org.id));

    // Another tenant's client should never be able to see or attach to this campaign.
    await expect(listCampaignLeads(dbOther, campaign!.id)).resolves.toEqual([]);

    await rawPrisma.organization.delete({ where: { id: otherOrg.id } });
  });
});
