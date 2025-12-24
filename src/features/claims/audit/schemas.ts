import { z } from "zod";

export const listClaimAuditSchema = {
  params: z.object({
    claimId: z.string().min(1),
  }),
  query: z.object({
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    includeTotal: z.coerce.boolean().default(false),
  }),
};

export type ListClaimAuditParams = z.infer<typeof listClaimAuditSchema.params>;
export type ListClaimAuditQuery = z.infer<typeof listClaimAuditSchema.query>;
