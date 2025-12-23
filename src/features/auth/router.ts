import { Router } from "express";
import { requireAuth, requirePermissions } from "../../lib/auth/index.js";
import { validate } from "../../lib/middleware/index.js";
import { asyncHandler } from "../../lib/utils/async-handler.js";
import {
  acceptInvitation,
  confirmPasswordReset,
  createInvitation,
  login,
  logout,
  logoutAll,
  me,
  requestPasswordReset,
  resendInvitation,
  validateResetToken,
  validateToken,
} from "./handlers.js";
import {
  acceptInvitationSchema,
  confirmPasswordResetSchema,
  createInvitationSchema,
  loginSchema,
  requestPasswordResetSchema,
  resendInvitationSchema,
  validateResetTokenSchema,
  validateTokenSchema,
} from "./schemas.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Session endpoints
// ─────────────────────────────────────────────────────────────────────────────

router.post("/login", validate(loginSchema), asyncHandler(login));
router.post("/logout", requireAuth(), asyncHandler(logout));
router.post("/logout-all", requireAuth(), asyncHandler(logoutAll));
router.get("/me", requireAuth(), me);

// ─────────────────────────────────────────────────────────────────────────────
// Invitation endpoints
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  "/invitations",
  requireAuth(),
  requirePermissions("users:invite"),
  validate(createInvitationSchema),
  asyncHandler(createInvitation),
);

router.get(
  "/invitations/:token",
  validate(validateTokenSchema),
  asyncHandler(validateToken),
);

router.post(
  "/invitations/accept",
  validate(acceptInvitationSchema),
  asyncHandler(acceptInvitation),
);

router.post(
  "/invitations/:id/resend",
  requireAuth(),
  requirePermissions("users:invite"),
  validate(resendInvitationSchema),
  asyncHandler(resendInvitation),
);

// ─────────────────────────────────────────────────────────────────────────────
// Password Reset endpoints
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  "/password-reset/request",
  validate(requestPasswordResetSchema),
  asyncHandler(requestPasswordReset),
);

router.get(
  "/password-reset/:token",
  validate(validateResetTokenSchema),
  asyncHandler(validateResetToken),
);

router.post(
  "/password-reset/confirm",
  validate(confirmPasswordResetSchema),
  asyncHandler(confirmPasswordReset),
);

export { router as authRouter };
