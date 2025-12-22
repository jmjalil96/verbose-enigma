import type { ErrorDetail } from "../../types/error.js";

export interface AppErrorOptions {
  message: string;
  statusCode: number;
  code: string;
  isOperational: boolean;
  details?: ErrorDetail[];
  cause?: unknown;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational: boolean;
  readonly details?: ErrorDetail[];

  constructor(options: AppErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = this.constructor.name;
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.isOperational = options.isOperational;
    this.details = options.details;

    Error.captureStackTrace(this, this.constructor);
  }

  static isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
  }
}
