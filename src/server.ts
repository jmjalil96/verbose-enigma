import { env } from "./lib/env.js";
import app from "./app.js";
import { logger, createModuleLogger } from "./lib/logger/index.js";
import { closeConnection, closeQueue } from "./lib/jobs/index.js";
import { connectDb, disconnectDb } from "./lib/db.js";

const serverLogger = createModuleLogger("server");

const SHUTDOWN_TIMEOUT_MS = 10_000; // Force exit after 10s

process.on("uncaughtException", (err: Error) => {
  logger.fatal({ err }, "Uncaught exception - shutting down");
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  logger.fatal({ reason }, "Unhandled rejection - shutting down");
  process.exit(1);
});

const server = app.listen(env.PORT, () => {
  serverLogger.info(
    {
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
    },
    `Server running on port ${String(env.PORT)}`,
  );

  // Verify database connection on startup
  connectDb().catch((err: unknown) => {
    logger.fatal({ err }, "Failed to connect to database");
    process.exit(1);
  });
});

// HTTP server timeouts (prevent slow clients from holding connections)
server.keepAliveTimeout = 65_000; // Slightly higher than typical LB idle timeout (60s)
server.headersTimeout = 66_000; // Must be higher than keepAliveTimeout
server.requestTimeout = 30_000; // Max time for entire request

let isShuttingDown = false;

function shutdown(signal: string): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  serverLogger.info(`${signal} received - shutting down`);

  // Force exit if graceful shutdown takes too long
  const forceExitTimeout = setTimeout(() => {
    serverLogger.error("Shutdown timeout - forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExitTimeout.unref(); // Don't keep process alive for this timer

  server.close(() => {
    Promise.all([closeQueue(), closeConnection(), disconnectDb()])
      .then(() => {
        serverLogger.info("Graceful shutdown complete");
        clearTimeout(forceExitTimeout);
        process.exit(0);
      })
      .catch((err: unknown) => {
        serverLogger.error({ err }, "Error during shutdown");
        clearTimeout(forceExitTimeout);
        process.exit(1);
      });
  });
}

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  shutdown("SIGINT");
});
