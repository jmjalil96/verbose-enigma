import { Queue, type JobsOptions } from "bullmq";
import { getConnection } from "./connection.js";
import type { JobTypeName, JobPayload, EnqueueOptions } from "./types.js";

const QUEUE_NAME = "jobs";

/** Default number of job attempts before failure */
export const DEFAULT_JOB_ATTEMPTS = 3;

/** Default job options */
const defaultJobOptions: JobsOptions = {
  attempts: DEFAULT_JOB_ATTEMPTS,
  backoff: {
    type: "exponential",
    delay: 1000,
  },
  removeOnComplete: { count: 1000 }, // Keep last 1000 for debugging
  removeOnFail: false, // Keep failed jobs for inspection
};

let queue: Queue | null = null;

/**
 * Get queue instance (lazy - only creates on first access).
 */
function getQueue(): Queue {
  queue ??= new Queue(QUEUE_NAME, {
    connection: getConnection(),
    defaultJobOptions,
  });
  return queue;
}

/**
 * Enqueue a job with type-safe payload.
 *
 * @param type - Job type name (e.g., "email.sendInvite")
 * @param data - Job payload (validated by Zod schema in processor)
 * @param options - Optional: jobId for idempotency, delay
 * @returns The created job
 *
 * @example
 * await enqueue("email.sendInvite", { invitationId, toEmail }, {
 *   jobId: `invite-email:${invitationId}`,
 * });
 */
export async function enqueue<T extends JobTypeName>(
  type: T,
  data: JobPayload<T>,
  options?: EnqueueOptions,
) {
  const jobOptions: JobsOptions = {};

  if (options?.jobId) {
    jobOptions.jobId = options.jobId;
  }

  if (options?.delay) {
    jobOptions.delay = options.delay;
  }

  return getQueue().add(type, data, jobOptions);
}

/**
 * Close queue connection.
 */
export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
