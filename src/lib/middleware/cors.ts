import cors from "cors";
import { env } from "../env.js";

function parseOrigins(origin: string): string | string[] | boolean {
  const trimmed = origin.trim();
  if (trimmed === "*") {
    return "*";
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  const origins = trimmed.split(",").map((o) => o.trim());
  if (origins.length === 1 && origins[0] !== undefined) {
    return origins[0];
  }
  return origins;
}

export function corsMiddleware() {
  return cors({
    origin: parseOrigins(env.CORS_ORIGIN),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
    credentials: env.CORS_ORIGIN !== "*",
    maxAge: 86400,
  });
}
