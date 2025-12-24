export type { EmailTemplate } from "./types.js";
export { inviteEmail, type InviteEmailData } from "./invite.js";
export {
  passwordResetEmail,
  type PasswordResetEmailData,
} from "./password-reset.js";
export {
  claimCreatedEmail,
  type ClaimCreatedEmailData,
} from "./claim-created.js";
