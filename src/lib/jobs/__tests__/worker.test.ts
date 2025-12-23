import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";

const mockWorkerCtor = vi.fn();
const mockOn = vi.fn();

let capturedProcessor: ((job: Job) => Promise<void>) | null = null;
let capturedOptions: unknown;
let capturedQueueName: string | null = null;

vi.mock("bullmq", async () => {
  return {
    Worker: class MockWorker {
      constructor(
        queueName: string,
        processor: (job: Job) => Promise<void>,
        options: unknown,
      ) {
        capturedQueueName = queueName;
        capturedProcessor = processor;
        capturedOptions = options;
        mockWorkerCtor(queueName, processor, options);
      }
      on = mockOn;
    },
  };
});

vi.mock("../connection.js", () => ({
  getConnection: () => ({ __conn: true }),
}));

const processJobSpy = vi.fn().mockResolvedValue(undefined);
vi.mock("../processors.js", () => ({
  processJob: (job: Job) => processJobSpy(job),
}));

describe("jobs worker", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    capturedProcessor = null;
    capturedOptions = undefined;
    capturedQueueName = null;
  });

  it("creates a Worker for queue 'jobs' with default concurrency", async () => {
    const { createWorker } = await import("../worker.js");
    createWorker();

    expect(mockWorkerCtor).toHaveBeenCalledTimes(1);
    expect(capturedQueueName).toBe("jobs");
    expect(capturedOptions).toEqual(
      expect.objectContaining({
        connection: expect.objectContaining({ __conn: true }),
        concurrency: 5,
      }),
    );
    expect(mockOn).toHaveBeenCalled(); // registers events
  });

  it("uses provided concurrency", async () => {
    const { createWorker } = await import("../worker.js");
    createWorker({ concurrency: 9 });

    expect(capturedOptions).toEqual(
      expect.objectContaining({
        concurrency: 9,
      }),
    );
  });

  it("delegates processing to processJob(job)", async () => {
    const { createWorker } = await import("../worker.js");
    createWorker();

    const job = { name: "x", id: "1", attemptsMade: 0, data: {} } as Job;
    expect(capturedProcessor).toBeTypeOf("function");

    await capturedProcessor?.(job);
    expect(processJobSpy).toHaveBeenCalledWith(job);
  });
});


