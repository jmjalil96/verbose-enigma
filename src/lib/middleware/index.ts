import type { Express } from "express";
import { env } from "../env.js";
import { httpLoggerMiddleware } from "../logger/index.js";
import { helmetMiddleware, hppMiddleware, rateLimiter } from "./security.js";
import { corsMiddleware } from "./cors.js";
import {
  compressionMiddleware,
  cookieMiddleware,
  jsonBodyMiddleware,
  timeoutMiddleware,
} from "./request.js";

export { validate } from "./validate.js";
export { helmetMiddleware, hppMiddleware, rateLimiter } from "./security.js";
export { corsMiddleware } from "./cors.js";
export {
  compressionMiddleware,
  cookieMiddleware,
  jsonBodyMiddleware,
  timeoutMiddleware,
} from "./request.js";

export function applyMiddleware(app: Express): void {
  // 1. Trust proxy (must be first for rate limiting behind load balancer)
  if (env.TRUST_PROXY) {
    app.set("trust proxy", 1);
  }

  // 2. HTTP logger (first middleware - req.log/req.id available for all)
  app.use(httpLoggerMiddleware());

  // 3. Security headers
  app.use(helmetMiddleware());

  // 4. CORS
  app.use(corsMiddleware());

  // 5. Compression
  app.use(compressionMiddleware());

  // 6. Rate limiting
  app.use(rateLimiter());

  // 7. HTTP parameter pollution protection
  app.use(hppMiddleware());

  // 8. JSON body parsing
  app.use(jsonBodyMiddleware());

  // 9. Cookie parsing
  app.use(cookieMiddleware());

  // 10. Request timeout
  app.use(timeoutMiddleware());
}
