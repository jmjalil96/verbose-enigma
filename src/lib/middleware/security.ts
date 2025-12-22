import helmet from "helmet";
import hpp from "hpp";
import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import { env } from "../env.js";
import { TooManyRequestsError } from "../errors/index.js";

const HEALTH_CHECK_PATHS = ["/api/health", "/health", "/ready", "/live"];

export function helmetMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
}

export function hppMiddleware() {
  return hpp();
}

export function rateLimiter() {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => HEALTH_CHECK_PATHS.includes(req.path),
    handler: (_req: Request, _res: Response, next: NextFunction) => {
      next(new TooManyRequestsError());
    },
  });
}
