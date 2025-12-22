import compression from "compression";
import cookieParser from "cookie-parser";
import express from "express";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { env } from "../env.js";
import { RequestTimeoutError } from "../errors/index.js";

export function compressionMiddleware() {
  return compression();
}

export function cookieMiddleware() {
  return cookieParser();
}

export function jsonBodyMiddleware() {
  return express.json({ limit: env.REQUEST_BODY_LIMIT });
}

export function timeoutMiddleware(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (res.headersSent || res.writableEnded) return;
      next(new RequestTimeoutError());
    }, env.REQUEST_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timer);
    };
    res.on("finish", cleanup);
    res.on("close", cleanup);

    next();
  };
}
