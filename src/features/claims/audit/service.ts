import { NotFoundError } from "../../../lib/errors/index.js";
import {
  countClaimAuditLogs,
  getClaimAuditLogs,
  getClaimForAuditOps,
} from "./repository.js";
import type { ListClaimAuditQuery } from "./schemas.js";

export async function listClaimAuditUseCase(
  claimId: string,
  query: ListClaimAuditQuery,
) {
  const claim = await getClaimForAuditOps(claimId);
  if (!claim) {
    throw new NotFoundError("Claim not found");
  }

  const [logs, total] = await Promise.all([
    getClaimAuditLogs(claimId, { cursor: query.cursor, limit: query.limit }),
    query.includeTotal ? countClaimAuditLogs(claimId) : undefined,
  ]);

  return { logs, total };
}
