import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";
import { createModuleLogger } from "./logger/index.js";

const log = createModuleLogger("db");

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

/**
 * Verify database connection. Call on startup.
 */
export async function connectDb(): Promise<void> {
  await db.$queryRaw`SELECT 1`;
  log.info("Database connected");
}

/**
 * Disconnect from database. Call during graceful shutdown.
 */
export async function disconnectDb(): Promise<void> {
  await db.$disconnect();
  log.info("Database disconnected");
}
