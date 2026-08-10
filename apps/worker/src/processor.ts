import { createTenantScopedClient } from "@virtelon/db";
import { runCampaignDiscovery, type CampaignDiscoveryResult } from "@virtelon/core/campaigns";
import type { CampaignDiscoveryJobData } from "@virtelon/queue";

/**
 * Re-checks mode/isActive at run time (not just at schedule time) — a
 * campaign could have been paused or switched out of AUTOMATED in the
 * minutes/hours between when this job was scheduled and when it fires.
 */
export async function processCampaignDiscoveryJob(
  data: CampaignDiscoveryJobData
): Promise<CampaignDiscoveryResult | { skipped: true; reason: string }> {
  const db = createTenantScopedClient(data.organizationId);
  const campaign = await db.campaign.findUnique({ where: { id: data.campaignId } });

  if (!campaign) return { skipped: true, reason: "campaign no longer exists" };
  if (!campaign.isActive) return { skipped: true, reason: "campaign is paused" };
  if (campaign.mode !== "AUTOMATED") return { skipped: true, reason: "campaign is no longer AUTOMATED" };

  return runCampaignDiscovery(db, data.organizationId, campaign);
}
