import { Redis } from "ioredis";
import { env } from "../env.js";
import { createModuleLogger } from "../logger/index.js";

const log = createModuleLogger("jobs");

let connection: Redis | null = null;

/**
 * Get Redis connection (lazy - only connects on first access).
 * Uses BullMQ-recommended ioredis options.
 */
export function getConnection(): Redis {
  if (!connection) {
    connection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required for BullMQ blocking commands
      enableReadyCheck: false, // Faster connection
    });

    connection.on("error", (err: Error) => {
      log.error({ err }, "Redis connection error");
    });

    connection.on("connect", () => {
      log.info("Redis connected");
    });
  }

  return connection;
}

/**
 * Close Redis connection (no-op if never connected).
 */
export async function closeConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
    log.info("Redis connection closed");
  }
}
