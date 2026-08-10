import { rawPrisma } from "@virtelon/db";
import { getCampaignDiscoveryQueue } from "@virtelon/queue";

const DEFAULT_DAILY_CRON = "0 9 * * *"; // 9am server time — campaigns without their own scheduleCron get this

/**
 * Registers (or refreshes) one BullMQ repeatable job per AUTOMATED, active
 * campaign, across every tenant — this is the only place that reads across
 * organizations, and it only ever reads Campaign rows to schedule work; the
 * actual job processor still runs through a tenant-scoped client.
 *
 * Safe to call repeatedly: passing the same `repeat.key` (the campaign id)
 * updates the existing repeatable registration instead of creating a
 * duplicate, so a campaign that changes its cron or target just gets synced
 * on the next call rather than accumulating stale schedules.
 */
export async function syncScheduledCampaigns(): Promise<{ scheduled: number }> {
  const campaigns = await rawPrisma.campaign.findMany({
    where: { mode: "AUTOMATED", isActive: true },
    select: { id: true, organizationId: true, scheduleCron: true },
  });

  const queue = getCampaignDiscoveryQueue();
  for (const campaign of campaigns) {
    await queue.add(
      "discover",
      { campaignId: campaign.id, organizationId: campaign.organizationId },
      {
        repeat: { pattern: campaign.scheduleCron ?? DEFAULT_DAILY_CRON, key: campaign.id },
        attempts: 3,
        backoff: { type: "exponential", delay: 30_000 },
      }
    );
  }

  return { scheduled: campaigns.length };
}
