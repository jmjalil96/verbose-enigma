import { describe, it, expect } from "vitest";
import { inviteEmail } from "../templates/invite.js";
import { passwordResetEmail } from "../templates/password-reset.js";

describe("Email Templates", () => {
  describe("inviteEmail", () => {
    const testData = {
      inviteLink: "https://app.example.com/invite/abc123",
      roleName: "Admin",
      expiresAt: new Date("2025-01-15T12:00:00Z"),
    };

    it("includes invite link in HTML", () => {
      const result = inviteEmail(testData);
      expect(result.html).toContain(testData.inviteLink);
    });

    it("includes invite link in text", () => {
      const result = inviteEmail(testData);
      expect(result.text).toContain(testData.inviteLink);
    });

    it("includes role name in subject", () => {
      const result = inviteEmail(testData);
      expect(result.subject).toContain(testData.roleName);
    });

    it("includes role name in HTML body", () => {
      const result = inviteEmail(testData);
      expect(result.html).toContain(testData.roleName);
    });

    it("includes role name in text body", () => {
      const result = inviteEmail(testData);
      expect(result.text).toContain(testData.roleName);
    });

    it("has non-empty subject, html, and text", () => {
      const result = inviteEmail(testData);
      expect(result.subject.length).toBeGreaterThan(0);
      expect(result.html.length).toBeGreaterThan(0);
      expect(result.text.length).toBeGreaterThan(0);
    });

    it("formats expiration date", () => {
      const result = inviteEmail(testData);
      // Should contain formatted date (e.g., "Wednesday, January 15, 2025")
      expect(result.html).toMatch(/January.*15.*2025/);
      expect(result.text).toMatch(/January.*15.*2025/);
    });
  });

  describe("passwordResetEmail", () => {
    const testData = {
      resetLink: "https://app.example.com/reset-password/xyz789",
      expiresAt: new Date("2025-01-15T14:30:00Z"),
    };

    it("includes reset link in HTML", () => {
      const result = passwordResetEmail(testData);
      expect(result.html).toContain(testData.resetLink);
    });

    it("includes reset link in text", () => {
      const result = passwordResetEmail(testData);
      expect(result.text).toContain(testData.resetLink);
    });

    it("has descriptive subject", () => {
      const result = passwordResetEmail(testData);
      expect(result.subject.toLowerCase()).toContain("password");
      expect(result.subject.toLowerCase()).toContain("reset");
    });

    it("has non-empty subject, html, and text", () => {
      const result = passwordResetEmail(testData);
      expect(result.subject.length).toBeGreaterThan(0);
      expect(result.html.length).toBeGreaterThan(0);
      expect(result.text.length).toBeGreaterThan(0);
    });

    it("formats expiration date with time", () => {
      const result = passwordResetEmail(testData);
      // Should contain formatted date with time
      expect(result.html).toMatch(/January.*15.*2025/);
      expect(result.text).toMatch(/January.*15.*2025/);
    });

    it("includes security notice about ignoring if not requested", () => {
      const result = passwordResetEmail(testData);
      expect(result.html.toLowerCase()).toContain("ignore");
      expect(result.text.toLowerCase()).toContain("ignore");
    });
  });
});
