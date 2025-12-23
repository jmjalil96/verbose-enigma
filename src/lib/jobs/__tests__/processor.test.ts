import { describe, it, expect, vi } from "vitest";
import type { Job } from "bullmq";
import { JobType, jobPayloadSchemas } from "../types.js";
import { processJob, processors } from "../processors.js";

// Mock the email handlers
vi.mock("../../../services/email/index.js", () => ({
  sendInviteEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

function createMockJob(name: string, data: unknown): Job {
  return {
    name,
    data,
    id: "test-job-id",
    attemptsMade: 0,
  } as unknown as Job;
}

describe("Job Processors", () => {
  describe("processJob", () => {
    it("throws for unknown job type", async () => {
      const job = createMockJob("unknown.jobType", {});

      await expect(processJob(job)).rejects.toThrow(
        "No processor registered for job type: unknown.jobType"
      );
    });

    it("routes to email.sendInvite processor", async () => {
      const { sendInviteEmail } = await import(
        "../../../services/email/index.js"
      );

      const job = createMockJob(JobType.EMAIL_SEND_INVITE, {
        invitationId: "inv-123",
        token: "abc-token",
      });

      await processJob(job);

      expect(sendInviteEmail).toHaveBeenCalledWith("inv-123", "abc-token");
    });

    it("routes to email.sendPasswordReset processor", async () => {
      const { sendPasswordResetEmail } = await import(
        "../../../services/email/index.js"
      );

      const job = createMockJob(JobType.EMAIL_SEND_PASSWORD_RESET, {
        userId: "user-123",
        token: "reset-token",
      });

      await processJob(job);

      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        "user-123",
        "reset-token"
      );
    });
  });

  describe("processors registry", () => {
    it("has a processor for each JobType", () => {
      const jobTypes = Object.values(JobType);

      for (const jobType of jobTypes) {
        expect(processors[jobType]).toBeDefined();
        expect(typeof processors[jobType]).toBe("function");
      }
    });
  });

  describe("payload validation", () => {
    describe("EMAIL_SEND_INVITE", () => {
      const schema = jobPayloadSchemas[JobType.EMAIL_SEND_INVITE];

      it("accepts valid payload", () => {
        const result = schema.safeParse({
          invitationId: "inv-123",
          token: "abc-token",
        });

        expect(result.success).toBe(true);
      });

      it("rejects missing invitationId", () => {
        const result = schema.safeParse({
          token: "abc-token",
        });

        expect(result.success).toBe(false);
      });

      it("rejects missing token", () => {
        const result = schema.safeParse({
          invitationId: "inv-123",
        });

        expect(result.success).toBe(false);
      });

      it("rejects empty payload", () => {
        const result = schema.safeParse({});

        expect(result.success).toBe(false);
      });
    });

    describe("EMAIL_SEND_PASSWORD_RESET", () => {
      const schema = jobPayloadSchemas[JobType.EMAIL_SEND_PASSWORD_RESET];

      it("accepts valid payload", () => {
        const result = schema.safeParse({
          userId: "user-123",
          token: "reset-token",
        });

        expect(result.success).toBe(true);
      });

      it("rejects missing userId", () => {
        const result = schema.safeParse({
          token: "reset-token",
        });

        expect(result.success).toBe(false);
      });

      it("rejects missing token", () => {
        const result = schema.safeParse({
          userId: "user-123",
        });

        expect(result.success).toBe(false);
      });
    });

    it("throws when processor receives invalid payload", async () => {
      const job = createMockJob(JobType.EMAIL_SEND_INVITE, {
        // Missing required fields
      });

      await expect(processJob(job)).rejects.toThrow();
    });
  });
});
