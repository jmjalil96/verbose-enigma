import { describe, it, expect, vi, beforeEach } from "vitest";

const mockOn = vi.fn();
const mockQuit = vi.fn().mockResolvedValue(undefined);
const mockRedisCtor = vi.fn();

vi.mock("../../env.js", () => ({
  env: {
    REDIS_URL: "redis://test:6379",
    LOG_LEVEL: "silent",
    NODE_ENV: "test",
  },
}));

vi.mock("ioredis", () => ({
  Redis: class MockRedis {
    constructor(public url: string, public options: unknown) {
      mockRedisCtor(url, options);
    }
    on = mockOn;
    quit = mockQuit;
  },
}));

describe("jobs connection", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("creates Redis connection lazily with BullMQ-safe options", async () => {
    const { getConnection } = await import("../connection.js");
    const conn = getConnection();

    expect(conn).toBeDefined();
    expect(mockRedisCtor).toHaveBeenCalledWith(
      "redis://test:6379",
      expect.objectContaining({
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      }),
    );
    // registers event handlers
    expect(mockOn).toHaveBeenCalled();
  });

  it("returns the same instance on subsequent getConnection calls", async () => {
    const { getConnection } = await import("../connection.js");
    const a = getConnection();
    const b = getConnection();

    expect(a).toBe(b);
    expect(mockRedisCtor).toHaveBeenCalledTimes(1);
  });

  it("closeConnection quits and resets singleton", async () => {
    const { getConnection, closeConnection } = await import("../connection.js");
    const a = getConnection();
    await closeConnection();
    const b = getConnection();

    expect(a).not.toBe(b);
    expect(mockQuit).toHaveBeenCalledTimes(1);
    expect(mockRedisCtor).toHaveBeenCalledTimes(2);
  });

  it("closeConnection is a no-op if never connected", async () => {
    const { closeConnection } = await import("../connection.js");
    await closeConnection();
    expect(mockQuit).not.toHaveBeenCalled();
  });
});


