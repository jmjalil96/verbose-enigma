import { Worker, type Job } from "bullmq";
import { getConnection } from "./connection.js";
import { processJob } from "./processors.js";
import { createModuleLogger } from "../logger/index.js";

const QUEUE_NAME = "jobs";
const log = createModuleLogger("jobs");

export interface WorkerOptions {
  /** Number of concurrent jobs (default: 5) */
  concurrency?: number;
}

/**
 * Create a BullMQ worker instance.
 *
 * The worker automatically handles:
 * - Stalled job detection
 * - Retry with exponential backoff
 * - Job locking
 */
export function createWorker(options: WorkerOptions = {}): Worker {
  const { concurrency = 5 } = options;

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      log.info(
        { jobName: job.name, jobId: job.id, attempt: job.attemptsMade + 1 },
        "Processing job",
      );

      await processJob(job);
    },
    {
      connection: getConnection(),
      concurrency,
    },
  );

  worker.on("completed", (job: Job) => {
    log.info(
      { jobName: job.name, jobId: job.id },
      "Job completed",
    );
  });

  worker.on("failed", (job: Job | undefined, err: Error) => {
    if (job) {
      log.error(
        {
          jobName: job.name,
          jobId: job.id,
          attemptsMade: job.attemptsMade,
          err,
        },
        "Job failed",
      );
    } else {
      log.error({ err }, "Job failed (job unavailable)");
    }
  });

  worker.on("error", (err: Error) => {
    log.error({ err }, "Worker error");
  });

  return worker;
}
