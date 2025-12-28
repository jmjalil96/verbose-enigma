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

  const offset = (query.page - 1) * query.limit;
  const [logs, total] = await Promise.all([
    getClaimAuditLogs(claimId, { offset, limit: query.limit }),
    countClaimAuditLogs(claimId),
  ]);

  return { logs, total, page: query.page, limit: query.limit };
}
