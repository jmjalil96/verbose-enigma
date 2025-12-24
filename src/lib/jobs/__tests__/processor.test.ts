import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import { JobType } from "../types.js";
import { processJob, processors } from "../processors.js";
import * as emailService from "../../../services/email/index.js";
import * as storageService from "../../../services/storage/index.js";
import type { ClaimFile } from "@prisma/client";

const { findManyMock, findUniqueMock, updateMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
}));

// Mock the dependencies
vi.mock("../../../services/email/index.js", () => ({
  sendInviteEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendClaimCreatedEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/storage/index.js", () => ({
  copyFile: vi.fn().mockResolvedValue(undefined),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  headObject: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../db.js", () => ({
  db: {
    claimFile: {
      findMany: findManyMock,
      findUnique: findUniqueMock,
      update: updateMock,
    },
  },
}));

function createMockJob(name: string, data: unknown, attemptsMade = 0): Job {
  return {
    name,
    data,
    id: "test-job-id",
    attemptsMade,
  } as unknown as Job;
}

describe("Job Processors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("processJob", () => {
    it("throws for unknown job type", async () => {
      const job = createMockJob("unknown.jobType", {});

      await expect(processJob(job)).rejects.toThrow(
        "No processor registered for job type: unknown.jobType",
      );
    });

    it("routes to EMAIL_SEND_INVITE processor", async () => {
      const job = createMockJob(JobType.EMAIL_SEND_INVITE, {
        invitationId: "inv-123",
        token: "abc-token",
      });

      await processJob(job);

      expect(emailService.sendInviteEmail).toHaveBeenCalledWith(
        "inv-123",
        "abc-token",
      );
    });

    it("routes to EMAIL_SEND_PASSWORD_RESET processor", async () => {
      const job = createMockJob(JobType.EMAIL_SEND_PASSWORD_RESET, {
        userId: "user-123",
        token: "reset-token",
      });

      await processJob(job);

      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        "user-123",
        "reset-token",
      );
    });

    it("routes to EMAIL_CLAIM_CREATED processor", async () => {
      const job = createMockJob(JobType.EMAIL_CLAIM_CREATED, {
        claimId: "claim-123",
        affiliateId: "aff-123",
      });

      await processJob(job);

      expect(emailService.sendClaimCreatedEmail).toHaveBeenCalledWith(
        "claim-123",
        "aff-123",
      );
    });

    it("routes to CLAIM_FILES_MIGRATE processor", async () => {
      const job = createMockJob(JobType.CLAIM_FILES_MIGRATE, {
        claimId: "claim-123",
        clientId: "client-123",
      });

      findManyMock.mockResolvedValue([]);

      await processJob(job);

      expect(findManyMock).toHaveBeenCalled();
    });

    it("routes to CLAIM_FILE_VERIFY processor", async () => {
      const job = createMockJob(JobType.CLAIM_FILE_VERIFY, {
        fileId: "file-123",
      });

      findUniqueMock.mockResolvedValue(null);

      await processJob(job);

      expect(findUniqueMock).toHaveBeenCalled();
    });

    it("routes to CLAIM_FILE_DELETE processor", async () => {
      const job = createMockJob(JobType.CLAIM_FILE_DELETE, {
        fileId: "file-123",
        targetKey: "some/key",
      });

      await processJob(job);

      expect(storageService.deleteFile).toHaveBeenCalledWith("some/key");
    });
  });

  describe("CLAIM_FILES_MIGRATE logic", () => {
    it("skips if no pending files found", async () => {
      const job = createMockJob(JobType.CLAIM_FILES_MIGRATE, {
        claimId: "claim-123",
        clientId: "client-123",
      });
      findManyMock.mockResolvedValue([]);

      const processor = processors[JobType.CLAIM_FILES_MIGRATE];
      if (!processor) throw new Error("Processor missing");
      await processor(job);

      expect(storageService.copyFile).not.toHaveBeenCalled();
    });

    it("migrates pending files successfully", async () => {
      const job = createMockJob(JobType.CLAIM_FILES_MIGRATE, {
        claimId: "claim-123",
        clientId: "client-123",
      });
      const mockFile = {
        id: "file-1",
        sourceKey: "src-key",
        targetKey: "tgt-key",
        fileName: "test.pdf",
      };
      findManyMock.mockResolvedValue([mockFile] as ClaimFile[]);

      const processor = processors[JobType.CLAIM_FILES_MIGRATE];
      if (!processor) throw new Error("Processor missing");
      await processor(job);

      expect(storageService.copyFile).toHaveBeenCalledWith({
        sourceKey: "src-key",
        destinationKey: "tgt-key",
      });
      expect(storageService.deleteFile).toHaveBeenCalledWith("src-key");
      expect(updateMock).toHaveBeenCalledWith({
        where: { id: "file-1" },
        data: expect.objectContaining({ status: "READY" }) as unknown,
      });
    });

    it("records error and rethrows if migration fails (not final attempt)", async () => {
      const job = createMockJob(JobType.CLAIM_FILES_MIGRATE, {
        claimId: "claim-123",
        clientId: "client-123",
      }, 0);
      const mockFile = {
        id: "file-1",
        sourceKey: "src-key",
        targetKey: "tgt-key",
        fileName: "test.pdf",
      };
      findManyMock.mockResolvedValue([mockFile] as ClaimFile[]);
      vi.mocked(storageService.copyFile).mockRejectedValue(new Error("S3 error"));

      const processor = processors[JobType.CLAIM_FILES_MIGRATE];
      if (!processor) throw new Error("Processor missing");
      await expect(processor(job)).rejects.toThrow("1 of 1 files failed to migrate");

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: "file-1" },
        data: { errorMessage: "S3 error" },
      });
    });

    it("marks as FAILED if migration fails on final attempt", async () => {
      const job = createMockJob(JobType.CLAIM_FILES_MIGRATE, {
        claimId: "claim-123",
        clientId: "client-123",
      }, 2); // Assuming DEFAULT_JOB_ATTEMPTS is 3
      const mockFile = {
        id: "file-1",
        sourceKey: "src-key",
        targetKey: "tgt-key",
        fileName: "test.pdf",
      };
      findManyMock.mockResolvedValue([mockFile] as ClaimFile[]);
      vi.mocked(storageService.copyFile).mockRejectedValue(new Error("Final S3 error"));

      const processor = processors[JobType.CLAIM_FILES_MIGRATE];
      if (!processor) throw new Error("Processor missing");
      await expect(processor(job)).rejects.toThrow("1 of 1 files failed to migrate");

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: "file-1" },
        data: { status: "FAILED", errorMessage: "Final S3 error" },
      });
    });
  });

  describe("CLAIM_FILE_VERIFY logic", () => {
    it("skips if file not found in DB", async () => {
      const job = createMockJob(JobType.CLAIM_FILE_VERIFY, { fileId: "file-123" });
      findUniqueMock.mockResolvedValue(null);

      const processor = processors[JobType.CLAIM_FILE_VERIFY];
      if (!processor) throw new Error("Processor missing");
      await processor(job);

      expect(storageService.headObject).not.toHaveBeenCalled();
    });

    it("skips if file is not PENDING", async () => {
      const job = createMockJob(JobType.CLAIM_FILE_VERIFY, { fileId: "file-123" });
      findUniqueMock.mockResolvedValue({ status: "READY" } as ClaimFile);

      const processor = processors[JobType.CLAIM_FILE_VERIFY];
      if (!processor) throw new Error("Processor missing");
      await processor(job);

      expect(storageService.headObject).not.toHaveBeenCalled();
    });

    it("marks READY if file exists in storage", async () => {
      const job = createMockJob(JobType.CLAIM_FILE_VERIFY, { fileId: "file-123" });
      findUniqueMock.mockResolvedValue({ 
        id: "file-123", 
        status: "PENDING", 
        targetKey: "key" 
      } as ClaimFile);
      vi.mocked(storageService.headObject).mockResolvedValue(true);

      const processor = processors[JobType.CLAIM_FILE_VERIFY];
      if (!processor) throw new Error("Processor missing");
      await processor(job);

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: "file-123" },
        data: { status: "READY" },
      });
    });

    it("throws if file does not exist in storage (not final attempt)", async () => {
      const job = createMockJob(JobType.CLAIM_FILE_VERIFY, { fileId: "file-123" }, 0);
      findUniqueMock.mockResolvedValue({ 
        id: "file-123", 
        status: "PENDING", 
        targetKey: "key" 
      } as ClaimFile);
      vi.mocked(storageService.headObject).mockResolvedValue(false);

      const processor = processors[JobType.CLAIM_FILE_VERIFY];
      if (!processor) throw new Error("Processor missing");
      await expect(processor(job)).rejects.toThrow("File not yet uploaded");
    });

    it("marks FAILED if file does not exist in storage (final attempt)", async () => {
      const job = createMockJob(JobType.CLAIM_FILE_VERIFY, { fileId: "file-123" }, 2);
      findUniqueMock.mockResolvedValue({ 
        id: "file-123", 
        status: "PENDING", 
        targetKey: "key" 
      } as ClaimFile);
      vi.mocked(storageService.headObject).mockResolvedValue(false);

      const processor = processors[JobType.CLAIM_FILE_VERIFY];
      if (!processor) throw new Error("Processor missing");
      await processor(job);

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: "file-123" },
        data: { status: "FAILED", errorMessage: "Upload not found" },
      });
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
});
