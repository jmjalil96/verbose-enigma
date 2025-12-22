import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import type { ErrorResponseBody } from "../../types/error.js";
import { AppError } from "./app-error.js";
import { InternalError, NotFoundError } from "./http-errors.js";

function normalizeError(thrown: unknown): Error {
  if (thrown instanceof Error) {
    return thrown;
  }
  return new InternalError("An unexpected error occurred", thrown);
}

export function notFoundHandler(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(new NotFoundError("Resource not found"));
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const errorId = randomUUID();
  const error = normalizeError(err);

  const isOperational = AppError.isAppError(error) && error.isOperational;
  const statusCode = AppError.isAppError(error) ? error.statusCode : 500;
  const code = AppError.isAppError(error) ? error.code : "INTERNAL_ERROR";

  // Log the error - single log point
  req.log.error(
    {
      err: error,
      errorId,
      code,
      statusCode,
      ...(err !== error && { thrown: err }),
    },
    error.message,
  );

  // Don't send response if headers already sent (race with timeout/streaming)
  if (res.headersSent) {
    return;
  }

  // Build response
  const response: ErrorResponseBody = {
    error: {
      code,
      message: isOperational ? error.message : "An unexpected error occurred",
      ...(isOperational &&
        AppError.isAppError(error) &&
        error.details && { details: error.details }),
    },
    requestId: req.id as string,
    errorId,
  };

  res.status(statusCode).json(response);
}
