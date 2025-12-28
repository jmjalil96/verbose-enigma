import { z } from "zod";

export const listClaimAuditSchema = {
  params: z.object({
    claimId: z.string().min(1),
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
};

export type ListClaimAuditParams = z.infer<typeof listClaimAuditSchema.params>;
export type ListClaimAuditQuery = z.infer<typeof listClaimAuditSchema.query>;
