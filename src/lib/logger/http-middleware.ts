import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import pino from "pino";
import { pinoHttp, type Options } from "pino-http";
import { logger } from "./logger.js";

const HEALTH_CHECK_PATHS = ["/api/health", "/health", "/ready", "/live"];

function customLogLevel(
  _req: IncomingMessage,
  res: ServerResponse,
  err?: Error,
): "error" | "warn" | "info" {
  if (err !== undefined || res.statusCode >= 500) return "error";
  if (res.statusCode >= 400) return "warn";
  return "info";
}

function customSuccessMessage(
  req: IncomingMessage,
  res: ServerResponse,
  responseTime: number,
): string {
  return `${req.method ?? "?"} ${req.url ?? "?"} ${String(res.statusCode)} - ${responseTime.toFixed(0)}ms`;
}

function customErrorMessage(
  req: IncomingMessage,
  res: ServerResponse,
  err: Error,
): string {
  return `${req.method ?? "?"} ${req.url ?? "?"} ${String(res.statusCode)} - ${err.message}`;
}

function reqSerializer(req: IncomingMessage) {
  return {
    method: req.method,
    url: req.url,
    headers: {
      "user-agent": req.headers["user-agent"],
      "content-type": req.headers["content-type"],
      "x-request-id": req.headers["x-request-id"],
    },
  };
}

export function httpLoggerMiddleware() {
  const options: Options = {
    logger,
    genReqId: (req, res) => {
      const existingId = req.headers["x-request-id"];
      const requestId =
        typeof existingId === "string" && existingId.length > 0
          ? existingId
          : randomUUID();

      req.id = requestId;
      res.setHeader("X-Request-Id", requestId);
      return requestId;
    },
    customLogLevel,
    customSuccessMessage,
    customErrorMessage,
    customProps: (req) => ({
      requestId: req.id,
    }),
    serializers: {
      req: reqSerializer,
      err: pino.stdSerializers.err,
    },
    autoLogging: {
      ignore: (req) => HEALTH_CHECK_PATHS.includes(req.url ?? ""),
    },
  };

  return pinoHttp(options);
}
