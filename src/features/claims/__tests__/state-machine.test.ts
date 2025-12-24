import { describe, expect, it } from "vitest";
import { ClaimStatus } from "@prisma/client";
import {
  canTransition,
  getEditableFields,
  isReasonRequired,
  isTerminal,
} from "../state-machine.js";

describe("claims state machine", () => {
  describe("canTransition", () => {
    it("DRAFT → IN_REVIEW: allowed", () => {
      expect(canTransition(ClaimStatus.DRAFT, ClaimStatus.IN_REVIEW)).toBe(
        true,
      );
    });

    it("DRAFT → SUBMITTED: not allowed", () => {
      expect(canTransition(ClaimStatus.DRAFT, ClaimStatus.SUBMITTED)).toBe(
        false,
      );
    });

    it("IN_REVIEW → SUBMITTED: allowed", () => {
      expect(canTransition(ClaimStatus.IN_REVIEW, ClaimStatus.SUBMITTED)).toBe(
        true,
      );
    });

    it("SUBMITTED → SETTLED: allowed", () => {
      expect(canTransition(ClaimStatus.SUBMITTED, ClaimStatus.SETTLED)).toBe(
        true,
      );
    });

    it("SETTLED → *: not allowed (terminal)", () => {
      expect(isTerminal(ClaimStatus.SETTLED)).toBe(true);
      expect(canTransition(ClaimStatus.SETTLED, ClaimStatus.CANCELLED)).toBe(
        false,
      );
      expect(canTransition(ClaimStatus.SETTLED, ClaimStatus.SUBMITTED)).toBe(
        false,
      );
    });

    it("CANCELLED → *: not allowed (terminal)", () => {
      expect(isTerminal(ClaimStatus.CANCELLED)).toBe(true);
      expect(canTransition(ClaimStatus.CANCELLED, ClaimStatus.IN_REVIEW)).toBe(
        false,
      );
    });
  });

  describe("getEditableFields", () => {
    it("DRAFT: core fields only", () => {
      expect(getEditableFields(ClaimStatus.DRAFT)).toEqual([
        "policyId",
        "description",
        "careType",
        "diagnosis",
        "incidentDate",
      ]);
    });

    it("IN_REVIEW: core + submission fields", () => {
      expect(getEditableFields(ClaimStatus.IN_REVIEW)).toEqual([
        "policyId",
        "description",
        "careType",
        "diagnosis",
        "incidentDate",
        "amountSubmitted",
        "submittedDate",
      ]);
    });

    it("SUBMITTED: settlement fields only", () => {
      expect(getEditableFields(ClaimStatus.SUBMITTED)).toEqual([
        "amountApproved",
        "amountDenied",
        "amountUnprocessed",
        "deductibleApplied",
        "copayApplied",
        "settlementDate",
        "settlementNumber",
        "settlementNotes",
      ]);
    });

    it("PENDING_INFO: no fields editable", () => {
      expect(getEditableFields(ClaimStatus.PENDING_INFO)).toEqual([]);
    });

    it("terminal states: no fields editable", () => {
      expect(getEditableFields(ClaimStatus.RETURNED)).toEqual([]);
      expect(getEditableFields(ClaimStatus.SETTLED)).toEqual([]);
      expect(getEditableFields(ClaimStatus.CANCELLED)).toEqual([]);
    });
  });

  describe("isReasonRequired", () => {
    it("IN_REVIEW → RETURNED: required", () => {
      expect(
        isReasonRequired(ClaimStatus.IN_REVIEW, ClaimStatus.RETURNED),
      ).toBe(true);
    });

    it("SUBMITTED → PENDING_INFO: required", () => {
      expect(
        isReasonRequired(ClaimStatus.SUBMITTED, ClaimStatus.PENDING_INFO),
      ).toBe(true);
    });

    it("* → CANCELLED: required", () => {
      expect(isReasonRequired(ClaimStatus.DRAFT, ClaimStatus.CANCELLED)).toBe(
        true,
      );
      expect(
        isReasonRequired(ClaimStatus.SUBMITTED, ClaimStatus.CANCELLED),
      ).toBe(true);
    });

    it("DRAFT → IN_REVIEW: not required", () => {
      expect(isReasonRequired(ClaimStatus.DRAFT, ClaimStatus.IN_REVIEW)).toBe(
        false,
      );
    });
  });
});
