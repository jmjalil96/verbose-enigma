import { logger, createModuleLogger } from "./lib/logger/index.js";
import { createWorker } from "./lib/jobs/worker.js";
import { closeConnection } from "./lib/jobs/connection.js";

const log = createModuleLogger("worker");

// Handle uncaught exceptions
process.on("uncaughtException", (err: Error) => {
  logger.fatal({ err }, "Uncaught exception - shutting down worker");
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

// Create worker
const worker = createWorker({ concurrency: 5 });

log.info("Worker started");

// Graceful shutdown
function shutdown(signal: string): void {
  log.info(`${signal} received - shutting down worker`);

  worker
    .close()
    .then(() => closeConnection())
    .then(() => {
      log.info("Worker shut down gracefully");
      process.exit(0);
    })
    .catch((err: unknown) => {
      log.error({ err }, "Error during worker shutdown");
      process.exit(1);
    });
}

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  shutdown("SIGINT");
});
