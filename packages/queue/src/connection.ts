import IORedis from "ioredis";
import { env } from "@virtelon/config";

/**
 * BullMQ requires `maxRetriesPerRequest: null` on any connection used for
 * blocking commands (Worker, QueueEvents) — without it ioredis gives up on
 * the blocking BRPOPLPUSH-style calls BullMQ relies on internally.
 */
export function createRedisConnection(): IORedis {
  return new IORedis(env.REDIS_URL ?? "redis://127.0.0.1:6379", { maxRetriesPerRequest: null });
}
