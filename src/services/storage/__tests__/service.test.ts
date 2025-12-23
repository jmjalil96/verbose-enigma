import { Readable } from "node:stream";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Create mock send function we can inspect
const mockSend = vi.fn();

// Mock AWS SDK with proper class
vi.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: class MockS3Client {
      send = mockSend;
      constructor(public config: unknown) {}
    },
    PutObjectCommand: class MockPutObjectCommand {
      constructor(public input: unknown) {}
    },
    GetObjectCommand: class MockGetObjectCommand {
      constructor(public input: unknown) {}
    },
    DeleteObjectCommand: class MockDeleteObjectCommand {
      constructor(public input: unknown) {}
    },
  };
});

const mockGetSignedUrl = vi.fn().mockResolvedValue("https://signed-url.example.com");
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

// Store original env
const originalEnv = { ...process.env };

describe("Storage Service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // Set required env vars for client initialization
    process.env.R2_ACCOUNT_ID = "test-account-id";
    process.env.R2_ACCESS_KEY_ID = "test-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.R2_BUCKET_NAME = "test-bucket";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("getClient", () => {
    it("throws when R2_ACCOUNT_ID is missing", async () => {
      delete process.env.R2_ACCOUNT_ID;
      const { getClient } = await import("../client.js");
      expect(() => getClient()).toThrow("R2 storage not configured: missing credentials");
    });

    it("throws when R2_ACCESS_KEY_ID is missing", async () => {
      delete process.env.R2_ACCESS_KEY_ID;
      const { getClient } = await import("../client.js");
      expect(() => getClient()).toThrow("R2 storage not configured: missing credentials");
    });

    it("throws when R2_SECRET_ACCESS_KEY is missing", async () => {
      delete process.env.R2_SECRET_ACCESS_KEY;
      const { getClient } = await import("../client.js");
      expect(() => getClient()).toThrow("R2 storage not configured: missing credentials");
    });

    it("returns S3Client when credentials are configured", async () => {
      const { getClient } = await import("../client.js");
      const client = getClient();
      expect(client).toBeDefined();
      expect((client as unknown as { config: unknown }).config).toEqual({
        region: "auto",
        endpoint: "https://test-account-id.r2.cloudflarestorage.com",
        credentials: {
          accessKeyId: "test-access-key",
          secretAccessKey: "test-secret-key",
        },
      });
    });
  });

  describe("getBucket", () => {
    it("throws when R2_BUCKET_NAME is missing", async () => {
      delete process.env.R2_BUCKET_NAME;
      const { getBucket } = await import("../client.js");
      expect(() => getBucket()).toThrow("R2 storage not configured: missing bucket name");
    });

    it("returns bucket name when configured", async () => {
      const { getBucket } = await import("../client.js");
      expect(getBucket()).toBe("test-bucket");
    });
  });

  describe("getSignedUploadUrl", () => {
    it("returns correct contract shape", async () => {
      const { getSignedUploadUrl } = await import("../service.js");

      const result = await getSignedUploadUrl("uploads/file.pdf", {
        contentType: "application/pdf",
      });

      expect(result).toEqual({
        url: "https://signed-url.example.com",
        key: "uploads/file.pdf",
        headers: {
          "Content-Type": "application/pdf",
        },
      });
    });

    it("calls getSignedUrl with PutObjectCommand containing correct params", async () => {
      const { getSignedUploadUrl } = await import("../service.js");

      await getSignedUploadUrl("uploads/photo.jpg", {
        contentType: "image/jpeg",
        expiresIn: 3600,
      });

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          input: {
            Bucket: "test-bucket",
            Key: "uploads/photo.jpg",
            ContentType: "image/jpeg",
          },
        }),
        { expiresIn: 3600 }
      );
    });

    it("uses default expiresIn of 900 seconds", async () => {
      const { getSignedUploadUrl } = await import("../service.js");

      await getSignedUploadUrl("uploads/photo.jpg", {
        contentType: "image/jpeg",
      });

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 900 }
      );
    });
  });

  describe("getSignedDownloadUrl", () => {
    it("returns a string URL", async () => {
      const { getSignedDownloadUrl } = await import("../service.js");

      const result = await getSignedDownloadUrl("uploads/file.pdf");

      expect(typeof result).toBe("string");
      expect(result).toBe("https://signed-url.example.com");
    });

    it("calls getSignedUrl with GetObjectCommand containing correct params", async () => {
      const { getSignedDownloadUrl } = await import("../service.js");

      await getSignedDownloadUrl("documents/report.pdf", { expiresIn: 1800 });

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          input: {
            Bucket: "test-bucket",
            Key: "documents/report.pdf",
          },
        }),
        { expiresIn: 1800 }
      );
    });
  });

  describe("upload", () => {
    it("calls S3Client.send with correct PutObjectCommand params", async () => {
      mockSend.mockResolvedValue({});
      const { upload } = await import("../service.js");

      await upload("uploads/test.txt", Buffer.from("test content"), {
        contentType: "text/plain",
        metadata: { userId: "123" },
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: "test-bucket",
            Key: "uploads/test.txt",
            Body: expect.any(Buffer),
            ContentType: "text/plain",
            Metadata: { userId: "123" },
          },
        })
      );
    });
  });

  describe("deleteFile", () => {
    it("calls S3Client.send with correct DeleteObjectCommand params", async () => {
      mockSend.mockResolvedValue({});
      const { deleteFile } = await import("../service.js");

      await deleteFile("uploads/old-file.pdf");

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: "test-bucket",
            Key: "uploads/old-file.pdf",
          },
        })
      );
    });
  });

  describe("downloadBuffer", () => {
    it("correctly concatenates stream chunks", async () => {
      const chunks = [Buffer.from("Hello, "), Buffer.from("World!")];

      // Create a readable stream that emits chunks
      const mockStream = new Readable({
        read() {
          const chunk = chunks.shift();
          if (chunk) {
            this.push(chunk);
          } else {
            this.push(null);
          }
        },
      });

      mockSend.mockResolvedValue({ Body: mockStream });
      const { downloadBuffer } = await import("../service.js");

      const result = await downloadBuffer("test-file.txt");

      expect(result.toString()).toBe("Hello, World!");
    });

    it("throws when response body is empty", async () => {
      mockSend.mockResolvedValue({ Body: null });
      const { downloadStream } = await import("../service.js");

      await expect(downloadStream("empty-file.txt")).rejects.toThrow(
        "Empty response for key: empty-file.txt"
      );
    });
  });
});
