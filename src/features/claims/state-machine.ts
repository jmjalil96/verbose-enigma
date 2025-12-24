import { ClaimStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Field Groups
// ─────────────────────────────────────────────────────────────────────────────

export const FIELD_GROUPS = {
  core: ["policyId", "description", "careType", "diagnosis", "incidentDate"],
  submission: ["amountSubmitted", "submittedDate"],
  settlement: [
    "amountApproved",
    "amountDenied",
    "amountUnprocessed",
    "deductibleApplied",
    "copayApplied",
    "settlementDate",
    "settlementNumber",
    "settlementNotes",
  ],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Transitions
// ─────────────────────────────────────────────────────────────────────────────

export const TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  DRAFT: [ClaimStatus.IN_REVIEW, ClaimStatus.CANCELLED],
  IN_REVIEW: [
    ClaimStatus.SUBMITTED,
    ClaimStatus.RETURNED,
    ClaimStatus.CANCELLED,
  ],
  SUBMITTED: [
    ClaimStatus.PENDING_INFO,
    ClaimStatus.SETTLED,
    ClaimStatus.CANCELLED,
  ],
  PENDING_INFO: [ClaimStatus.SUBMITTED, ClaimStatus.CANCELLED],
  RETURNED: [],
  SETTLED: [],
  CANCELLED: [],
};

export const TERMINAL: ClaimStatus[] = [
  ClaimStatus.RETURNED,
  ClaimStatus.SETTLED,
  ClaimStatus.CANCELLED,
];

// ─────────────────────────────────────────────────────────────────────────────
// Editable Fields by State
// ─────────────────────────────────────────────────────────────────────────────

export const EDITABLE: Record<ClaimStatus, readonly string[]> = {
  DRAFT: FIELD_GROUPS.core,
  IN_REVIEW: [...FIELD_GROUPS.core, ...FIELD_GROUPS.submission],
  SUBMITTED: FIELD_GROUPS.settlement,
  PENDING_INFO: [],
  RETURNED: [],
  SETTLED: [],
  CANCELLED: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Invariants (accumulated required fields per state)
// ─────────────────────────────────────────────────────────────────────────────

export const INVARIANTS: Record<ClaimStatus, readonly string[]> = {
  DRAFT: [],
  IN_REVIEW: FIELD_GROUPS.core,
  SUBMITTED: [...FIELD_GROUPS.core, ...FIELD_GROUPS.submission],
  PENDING_INFO: [...FIELD_GROUPS.core, ...FIELD_GROUPS.submission],
  RETURNED: FIELD_GROUPS.core,
  SETTLED: [
    ...FIELD_GROUPS.core,
    ...FIELD_GROUPS.submission,
    ...FIELD_GROUPS.settlement,
  ],
  CANCELLED: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Transition rules (reason requirements)
// ─────────────────────────────────────────────────────────────────────────────

const REASON_REQUIRED: readonly string[] = [
  "IN_REVIEW->RETURNED",
  "SUBMITTED->PENDING_INFO",
  "PENDING_INFO->SUBMITTED",
  "*->CANCELLED",
];

export const isReasonRequired = (
  from: ClaimStatus,
  to: ClaimStatus,
): boolean => {
  const key = `${from}->${to}`;
  if (REASON_REQUIRED.includes(key)) return true;
  return REASON_REQUIRED.includes(`*->${to}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

export const isTerminal = (status: ClaimStatus): boolean =>
  TERMINAL.includes(status);

export const getEditableFields = (status: ClaimStatus): readonly string[] =>
  EDITABLE[status];

export const getInvariants = (status: ClaimStatus): readonly string[] =>
  INVARIANTS[status];

export const canTransition = (from: ClaimStatus, to: ClaimStatus): boolean =>
  TRANSITIONS[from].includes(to);

export const getAllowedTransitions = (status: ClaimStatus): ClaimStatus[] =>
  TRANSITIONS[status];
