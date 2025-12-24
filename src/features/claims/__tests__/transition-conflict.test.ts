import { describe, expect, it, vi } from "vitest";
import { ClaimStatus } from "@prisma/client";

const getClaimForUpdateMock = vi.fn();
const getClaimStatusMock = vi.fn();
const updateClaimByIdMock = vi.fn();
const createClaimHistoryMock = vi.fn();

vi.mock("../repository.js", () => ({
  getClaimForUpdate: getClaimForUpdateMock,
  getClaimStatus: getClaimStatusMock,
  updateClaimById: updateClaimByIdMock,
  createClaimHistory: createClaimHistoryMock,
}));

const transactionMock = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
  fn({}),
);
vi.mock("../../../lib/db.js", () => ({
  db: { $transaction: transactionMock },
}));

describe("transitionClaimUseCase - conflict detection", () => {
  it("throws ConflictError when status changes between read and write", async () => {
    const { transitionClaimUseCase } = await import("../service.js");

    const claimId = "claim-1";

    getClaimForUpdateMock.mockResolvedValue({
      id: claimId,
      status: ClaimStatus.IN_REVIEW,
      policyId: "policy-1",
      description: "desc",
      careType: "AMBULATORY",
      diagnosis: "dx",
      incidentDate: new Date("2025-01-01"),
      amountSubmitted: "10.00",
      submittedDate: new Date("2025-01-02"),
      amountApproved: null,
      amountDenied: null,
      amountUnprocessed: null,
      deductibleApplied: null,
      copayApplied: null,
      settlementDate: null,
      settlementNumber: null,
      settlementNotes: null,
    });

    // Simulate a concurrent update that changed the status.
    getClaimStatusMock.mockResolvedValue({
      id: claimId,
      status: ClaimStatus.SUBMITTED,
    });

    await expect(
      transitionClaimUseCase(
        {
          id: "user-1",
          role: { scopeType: "UNLIMITED" },
          permissions: [],
        } as never,
        claimId,
        { toStatus: ClaimStatus.RETURNED, reason: "missing info" },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(updateClaimByIdMock).not.toHaveBeenCalled();
  });
});
