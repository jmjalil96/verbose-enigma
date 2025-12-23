import type { Job } from "bullmq";
import { createModuleLogger } from "../logger/index.js";
import { JobType, jobPayloadSchemas } from "./types.js";
import {
  sendInviteEmail,
  sendPasswordResetEmail,
} from "../../services/email/index.js";

const log = createModuleLogger("jobs");

/**
 * Job processors registry.
 */
export const processors: Record<string, (job: Job) => Promise<void>> = {
  [JobType.EMAIL_SEND_INVITE]: async (job) => {
    const payload = jobPayloadSchemas[JobType.EMAIL_SEND_INVITE].parse(
      job.data,
    );
    await sendInviteEmail(payload.invitationId, payload.token);
  },

  [JobType.EMAIL_SEND_PASSWORD_RESET]: async (job) => {
    const payload = jobPayloadSchemas[JobType.EMAIL_SEND_PASSWORD_RESET].parse(
      job.data,
    );
    await sendPasswordResetEmail(payload.userId, payload.token);
  },
};

/**
 * Main processor function - routes jobs to their handlers.
 */
export async function processJob(job: Job): Promise<void> {
  const processor = processors[job.name];

  if (!processor) {
    log.error({ jobName: job.name, jobId: job.id }, "No processor for job type");
    throw new Error(`No processor registered for job type: ${job.name}`);
  }

  await processor(job);
}
