import pino, { type Logger, type LoggerOptions } from "pino";
import { env } from "../env.js";

function buildLoggerOptions(): LoggerOptions {
  const options: LoggerOptions = {
    level: env.LOG_LEVEL,
    serializers: {
      err: pino.stdSerializers.err,
    },
    redact: {
      paths: ["*.password", "*.token", "*.secret", "*.apiKey"],
      censor: "[REDACTED]",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  };

  if (env.NODE_ENV !== "production") {
    options.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    };
  }

  return options;
}

export const logger: Logger = pino(buildLoggerOptions());

export function createModuleLogger(moduleName: string): Logger {
  return logger.child({ module: moduleName });
}
