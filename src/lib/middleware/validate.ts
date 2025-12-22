import type { Request, Response, NextFunction, RequestHandler } from "express";
import { z, type ZodType } from "zod";
import { ValidationError } from "../errors/index.js";
import type { ErrorDetail } from "../../types/error.js";

interface RequestSchema {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

function formatZodErrors(error: z.ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

export function validate(schema: RequestSchema): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: ErrorDetail[] = [];

    if (schema.body) {
      const result = schema.body.safeParse(req.body);
      if (!result.success) {
        errors.push(
          ...formatZodErrors(result.error).map((e) => ({
            ...e,
            field: e.field ? `body.${e.field}` : "body",
          })),
        );
      } else {
        req.body = result.data;
      }
    }

    if (schema.query) {
      const result = schema.query.safeParse(req.query);
      if (!result.success) {
        errors.push(
          ...formatZodErrors(result.error).map((e) => ({
            ...e,
            field: e.field ? `query.${e.field}` : "query",
          })),
        );
      } else {
        req.query = result.data as typeof req.query;
      }
    }

    if (schema.params) {
      const result = schema.params.safeParse(req.params);
      if (!result.success) {
        errors.push(
          ...formatZodErrors(result.error).map((e) => ({
            ...e,
            field: e.field ? `params.${e.field}` : "params",
          })),
        );
      } else {
        req.params = result.data as typeof req.params;
      }
    }

    if (errors.length > 0) {
      next(new ValidationError("Validation failed", errors));
      return;
    }

    next();
  };
}
