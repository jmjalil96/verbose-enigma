import type { AuditAction, Prisma } from "@prisma/client";

export interface AuditEvent {
  action: AuditAction;
  resource: string;
  resourceId?: string;
  metadata?: Prisma.InputJsonObject;
  // Optional overrides (normally extracted from request context)
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}
