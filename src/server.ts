import { env } from "./lib/env.js";
import app from "./app.js";
import { logger, createModuleLogger } from "./lib/logger/index.js";

const serverLogger = createModuleLogger("server");

process.on("uncaughtException", (err: Error) => {
  logger.fatal({ err }, "Uncaught exception - shutting down");
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

const server = app.listen(env.PORT, () => {
  serverLogger.info(
    {
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
    },
    `Server running on port ${String(env.PORT)}`,
  );
});

process.on("SIGTERM", () => {
  serverLogger.info("SIGTERM received - shutting down");
  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  serverLogger.info("SIGINT received - shutting down");
  server.close(() => {
    process.exit(0);
  });
});
