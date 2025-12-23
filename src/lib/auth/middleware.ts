import type { RequestHandler } from "express";
import { env } from "../env.js";
import { ForbiddenError, UnauthorizedError } from "../errors/index.js";
import { clearSessionCookie } from "./cookie.js";
import {
  findSessionByTokenHash,
  updateSessionLastActive,
} from "./repository.js";
import {
  buildSessionUser,
  hashToken,
  shouldUpdateLastActive,
  validateSession,
} from "./service.js";

export function requireAuth(): RequestHandler {
  return async (req, res, next) => {
    const cookies = req.cookies as Record<string, string | undefined>;
    const token = cookies[env.SESSION_COOKIE_NAME];

    if (!token) {
      next(new UnauthorizedError("Authentication required"));
      return;
    }

    const tokenHash = hashToken(token);
    const session = await findSessionByTokenHash(tokenHash);

    if (!session) {
      clearSessionCookie(res);
      next(new UnauthorizedError("Authentication required"));
      return;
    }

    const validation = validateSession(session);

    if (!validation.valid) {
      req.log.debug({ reason: validation.reason }, "Session validation failed");
      clearSessionCookie(res);
      next(new UnauthorizedError("Authentication required"));
      return;
    }

    req.user = buildSessionUser(session);

    if (shouldUpdateLastActive(session)) {
      void updateSessionLastActive(session.id).catch((err: unknown) => {
        req.log.warn({ err }, "Failed to update session lastActiveAt");
      });
    }

    next();
  };
}

export function requirePermissions(
  required: string | string[],
): RequestHandler {
  const requiredList = Array.isArray(required) ? required : [required];

  return (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError("Authentication required"));
      return;
    }

    if (requiredList.length === 0) {
      next();
      return;
    }

    const userPerms = new Set(req.user.permissions);
    const missing = requiredList.filter((p) => !userPerms.has(p));

    if (missing.length > 0) {
      req.log.debug({ required: requiredList, missing }, "Permission denied");
      next(new ForbiddenError());
      return;
    }

    next();
  };
}
