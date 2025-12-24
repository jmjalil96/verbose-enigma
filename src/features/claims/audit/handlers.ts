import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../../../lib/errors/index.js";
import { buildIdCursorPagination } from "../../../lib/utils/pagination.js";
import type { ListClaimAuditParams, ListClaimAuditQuery } from "./schemas.js";
import { listClaimAuditUseCase } from "./service.js";

export async function listClaimAudit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const { claimId } = req.params as ListClaimAuditParams;
  const query = req.query as unknown as ListClaimAuditQuery;

  const { logs, total } = await listClaimAuditUseCase(claimId, query);
  const response = buildIdCursorPagination(logs, query.limit, total);

  req.log.info(
    { userId: user.id, claimId, logCount: response.data.length },
    "Claim audit logs listed",
  );

  res.json(response);
}
