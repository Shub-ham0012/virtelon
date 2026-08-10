import { Worker } from "bullmq";
import { CAMPAIGN_DISCOVERY_QUEUE, createRedisConnection } from "@virtelon/queue";
import { processCampaignDiscoveryJob } from "./processor";
import { syncScheduledCampaigns } from "./scheduler";

const SCHEDULE_SYNC_INTERVAL_MS = 15 * 60 * 1000;

async function main() {
  const worker = new Worker(
    CAMPAIGN_DISCOVERY_QUEUE,
    async (job) => processCampaignDiscoveryJob(job.data),
    { connection: createRedisConnection() }
  );

  worker.on("completed", (job, result) => {
    console.log(`[worker] campaign discovery ${job.id} done:`, result);
  });
  worker.on("failed", (job, err) => {
    console.error(`[worker] campaign discovery ${job?.id} failed:`, err);
  });

  const initial = await syncScheduledCampaigns();
  console.log(`[worker] scheduled ${initial.scheduled} automated campaign(s)`);

  const interval = setInterval(async () => {
    try {
      const result = await syncScheduledCampaigns();
      console.log(`[worker] re-synced schedules — ${result.scheduled} automated campaign(s)`);
    } catch (err) {
      console.error("[worker] schedule sync failed:", err);
    }
  }, SCHEDULE_SYNC_INTERVAL_MS);

  const shutdown = async () => {
    clearInterval(interval);
    await worker.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("[worker] running — waiting for campaign-discovery jobs");
}

main().catch((err) => {
  console.error("[worker] fatal error during startup:", err);
  process.exit(1);
});
