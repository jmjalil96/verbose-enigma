import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  // Logging
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  // Proxy (for rate limiting behind load balancer)
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

  // CORS
  CORS_ORIGIN: z.string().default("*"),

  // Request
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  REQUEST_BODY_LIMIT: z.string().default("100kb"),

  // Database
  DATABASE_URL: z.url(),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = z.treeifyError(result.error);
    throw new Error(
      `Invalid environment variables:\n${JSON.stringify(formatted, null, 2)}`,
    );
  }

  return result.data;
}

export const env = parseEnv();
