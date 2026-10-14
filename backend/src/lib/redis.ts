/**
 * lib/redis.ts — Shared Redis client (ioredis). [L-4a]
 * Used for: rate limiting, distributed locks, caching, BullMQ backing.
 * Never use in-memory substitutes for cross-request coordination. [S-9, S-10]
 */
import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

let _redis: Redis | undefined;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,
      lazyConnect: false,
    });

    _redis.on("error", (err) => {
      logger.error({ err }, "Redis connection error");
    });

    _redis.on("connect", () => {
      logger.info("Redis connected");
    });
  }

  return _redis;
}
