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

  // Auth
  SESSION_COOKIE_NAME: z.string().default("session"),

  // Redis (for job queue)
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Email
  EMAIL_PROVIDER: z.enum(["smtp", "resend"]).default("smtp"),
  EMAIL_FROM: z.string().default("noreply@example.com"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  RESEND_API_KEY: z.string().optional(),
  APP_URL: z.url().default("http://localhost:3000"),

  // Storage (Cloudflare R2)
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET_NAME: z.string().min(1).optional(),
  R2_PUBLIC_URL: z.string().min(1).optional(),
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
