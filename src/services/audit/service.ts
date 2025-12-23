import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { db } from "../../lib/db.js";
import { createModuleLogger } from "../../lib/logger/index.js";
import type { AuditEvent } from "./types.js";

const log = createModuleLogger("audit");

/**
 * Log an audit event. Fire-and-forget - never throws.
 */
export function logAudit(event: AuditEvent, req?: Request): void {
  // Extract context from request if provided
  const userId = event.userId ?? req?.user?.id;
  const ipAddress = event.ipAddress ?? req?.ip;
  const userAgent = event.userAgent ?? req?.get("user-agent");
  const requestId =
    event.requestId ?? (typeof req?.id === "string" ? req.id : undefined);

  const data: Prisma.AuditLogCreateInput = {
    action: event.action,
    resource: event.resource,
    resourceId: event.resourceId,
    metadata: event.metadata,
    ipAddress,
    userAgent,
    requestId,
    ...(userId && { user: { connect: { id: userId } } }),
  };

  // Fire-and-forget with error logging
  db.auditLog.create({ data }).catch((err: unknown) => {
    log.error({ err, userId, action: event.action, resource: event.resource }, "Failed to write audit log");
  });
}
