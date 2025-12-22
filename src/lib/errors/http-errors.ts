import type { ErrorDetail } from "../../types/error.js";
import { AppError } from "./app-error.js";

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: ErrorDetail[]) {
    super({
      message,
      statusCode: 400,
      code: "BAD_REQUEST",
      isOperational: true,
      details,
    });
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: ErrorDetail[]) {
    super({
      message,
      statusCode: 400,
      code: "VALIDATION_ERROR",
      isOperational: true,
      details,
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super({
      message,
      statusCode: 401,
      code: "UNAUTHORIZED",
      isOperational: true,
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super({
      message,
      statusCode: 403,
      code: "FORBIDDEN",
      isOperational: true,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super({
      message,
      statusCode: 404,
      code: "NOT_FOUND",
      isOperational: true,
    });
  }
}

export class RequestTimeoutError extends AppError {
  constructor(message = "Request timeout") {
    super({
      message,
      statusCode: 408,
      code: "REQUEST_TIMEOUT",
      isOperational: true,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", details?: ErrorDetail[]) {
    super({
      message,
      statusCode: 409,
      code: "CONFLICT",
      isOperational: true,
      details,
    });
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests") {
    super({
      message,
      statusCode: 429,
      code: "TOO_MANY_REQUESTS",
      isOperational: true,
    });
  }
}

export class InternalError extends AppError {
  constructor(message = "Internal server error", cause?: unknown) {
    super({
      message,
      statusCode: 500,
      code: "INTERNAL_ERROR",
      isOperational: false,
      cause,
    });
  }
}
