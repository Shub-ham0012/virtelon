import type { CampaignMode, TenantScopedClient } from "@virtelon/db";

export interface CampaignInput {
  name: string;
  category: string;
  location: string;
  serviceId?: string | null;
  serviceLabel: string;
  dailyLeadTarget: number;
  minLeadScore: number;
  messageTone: string;
  language: string;
  mode: CampaignMode;
}

export async function createCampaign(db: TenantScopedClient, organizationId: string, input: CampaignInput) {
  return db.campaign.create({ data: { organizationId, ...input } });
}

export async function listCampaigns(db: TenantScopedClient) {
  return db.campaign.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getCampaign(db: TenantScopedClient, id: string) {
  return db.campaign.findUnique({ where: { id } });
}

/** Attaches leads to a campaign. Safe to call repeatedly with overlapping
 * lead lists (e.g. re-running discovery for the same campaign) — already
 *-attached leads are silently skipped rather than erroring. */
export async function addLeadsToCampaign(db: TenantScopedClient, campaignId: string, leadIds: string[]): Promise<number> {
  if (leadIds.length === 0) return 0;
  const result = await db.campaignLead.createMany({
    data: leadIds.map((leadId) => ({ campaignId, leadId })),
    skipDuplicates: true,
  });
  return result.count;
}

export async function listCampaignLeads(db: TenantScopedClient, campaignId: string) {
  const campaignLeads = await db.campaignLead.findMany({
    where: { campaignId },
    include: { lead: true },
    orderBy: { addedAt: "desc" },
  });
  return campaignLeads.map((cl) => cl.lead);
}

export async function countCampaignLeads(db: TenantScopedClient, campaignId: string) {
  return db.campaignLead.count({ where: { campaignId } });
}
