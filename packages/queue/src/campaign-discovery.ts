import { Queue } from "bullmq";
import { createRedisConnection } from "./connection";

export const CAMPAIGN_DISCOVERY_QUEUE = "campaign-discovery";

export interface CampaignDiscoveryJobData {
  campaignId: string;
  organizationId: string;
}

let queue: Queue<CampaignDiscoveryJobData> | null = null;

/** Lazily-created singleton — one Redis connection per process, not one per call. */
export function getCampaignDiscoveryQueue(): Queue<CampaignDiscoveryJobData> {
  if (!queue) {
    queue = new Queue<CampaignDiscoveryJobData>(CAMPAIGN_DISCOVERY_QUEUE, { connection: createRedisConnection() });
  }
  return queue;
}
