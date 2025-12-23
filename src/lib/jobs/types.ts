import { z } from "zod";
import type { Job } from "bullmq";

/**
 * Job type names - add new job types here.
 * Pattern: "domain.action" (e.g., "email.sendInvite")
 */
export const JobType = {
  EMAIL_SEND_INVITE: "email.sendInvite",
  EMAIL_SEND_PASSWORD_RESET: "email.sendPasswordReset",
} as const;

export type JobTypeName = (typeof JobType)[keyof typeof JobType];

/**
 * Job payload schemas - validate payloads at enqueue and process time.
 * Add a schema for each job type.
 */
export const jobPayloadSchemas = {
  [JobType.EMAIL_SEND_INVITE]: z.object({
    invitationId: z.string(),
    token: z.string(),
  }),
  [JobType.EMAIL_SEND_PASSWORD_RESET]: z.object({
    userId: z.string(),
    token: z.string(),
  }),
} as const satisfies Record<string, z.ZodType>;

/**
 * Infer payload type from job type name.
 */
export type JobPayload<T extends JobTypeName> =
  T extends keyof typeof jobPayloadSchemas
    ? z.infer<(typeof jobPayloadSchemas)[T]>
    : never;

/**
 * Union of all possible job payloads (for processor typing).
 */
export type AnyJobPayload = JobTypeName extends never
  ? Record<string, unknown>
  : {
      [K in JobTypeName]: { type: K; data: JobPayload<K> };
    }[JobTypeName];

/**
 * Job processor function type.
 */
export type JobProcessor<T extends JobTypeName = JobTypeName> = (
  job: Job<JobPayload<T>>,
) => Promise<void>;

/**
 * Processor registry type - maps job types to handlers.
 */
export type ProcessorRegistry = {
  [K in JobTypeName]: JobProcessor<K>;
};

/**
 * Options for enqueueing a job.
 */
export interface EnqueueOptions {
  /** Deterministic job ID for idempotency (e.g., `invite-email:${invitationId}`) */
  jobId?: string;
  /** Delay in milliseconds before job becomes available */
  delay?: number;
}
