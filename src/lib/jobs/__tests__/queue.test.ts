import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAdd = vi.fn();
const mockClose = vi.fn();
const mockQueueCtor = vi.fn();

vi.mock("bullmq", () => ({
  Queue: class MockQueue {
    constructor(public name: string, public opts: unknown) {
      mockQueueCtor(name, opts);
    }
    add = mockAdd;
    close = mockClose;
  },
}));

vi.mock("../connection.js", () => ({
  getConnection: () => ({ __conn: true }),
}));

describe("jobs queue", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("creates the Queue lazily on first enqueue and reuses it", async () => {
    const { enqueue } = await import("../queue.js");

    await enqueue("email.sendInvite", { invitationId: "id", token: "t" });
    await enqueue("email.sendInvite", { invitationId: "id2", token: "t2" });

    expect(mockQueueCtor).toHaveBeenCalledTimes(1);
    expect(mockQueueCtor).toHaveBeenCalledWith(
      "jobs",
      expect.objectContaining({
        connection: expect.objectContaining({ __conn: true }) as unknown,
        defaultJobOptions: expect.objectContaining({
          attempts: 3,
          backoff: expect.objectContaining({ type: "exponential", delay: 1000 }) as unknown,
        }) as unknown,
      }) as unknown,
    );
    expect(mockAdd).toHaveBeenCalledTimes(2);
  });

  it("passes jobId and delay options through to Queue.add", async () => {
    const { enqueue } = await import("../queue.js");

    await enqueue(
      "email.sendInvite",
      { invitationId: "id", token: "t" },
      { jobId: "job-1", delay: 1234 },
    );

    expect(mockAdd).toHaveBeenCalledWith(
      "email.sendInvite",
      { invitationId: "id", token: "t" },
      expect.objectContaining({ jobId: "job-1", delay: 1234 }),
    );
  });

  it("closeQueue is a no-op if queue was never created", async () => {
    const { closeQueue } = await import("../queue.js");

    await closeQueue();

    expect(mockQueueCtor).not.toHaveBeenCalled();
    expect(mockClose).not.toHaveBeenCalled();
  });

  it("closeQueue closes and resets the queue singleton", async () => {
    const { enqueue, closeQueue } = await import("../queue.js");

    await enqueue("email.sendInvite", { invitationId: "id", token: "t" });
    await closeQueue();
    await enqueue("email.sendInvite", { invitationId: "id2", token: "t2" });

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockQueueCtor).toHaveBeenCalledTimes(2);
  });
});


