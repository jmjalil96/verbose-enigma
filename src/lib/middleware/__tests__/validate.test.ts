import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { validate } from "../validate.js";
import type { Request, Response } from "express";

describe("Validate Middleware", () => {
  const schema = {
    body: z.object({
      name: z.string(),
      age: z.number().optional(),
    }),
    query: z.object({
      limit: z.coerce.number().default(20),
    }),
    params: z.object({
      id: z.string(),
    }),
  };

  const mockResponse = () => {
    const res = {} as Response;
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  const mockNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes valid data and transforms it", () => {
    const mw = validate(schema);
    const req = {
      body: { name: "John", age: 30 },
      query: { limit: "50" }, // string to be coerced
      params: { id: "123" },
    } as unknown as Request;

    mw(req, mockResponse(), mockNext);

    expect(mockNext).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: "John", age: 30 });
    const queryData = req.query as unknown as { limit: number };
    expect(queryData.limit).toBe(50); // coerced to number
    expect(req.params.id).toBe("123");
  });

  it("calls next with ValidationError on invalid body", () => {
    const mw = validate(schema);
    const req = {
      body: { age: "not-a-number" }, // missing name, wrong age type
      query: {},
      params: { id: "123" },
    } as unknown as Request;

    mw(req, mockResponse(), mockNext);

    const firstCall = mockNext.mock.calls[0];
    if (!firstCall) throw new Error("Next not called");
    const error = firstCall[0] as { name: string; details: unknown[] };
    expect(error.name).toBe("ValidationError");
    expect(error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "body.name", code: "invalid_type" }),
      expect.objectContaining({ field: "body.age", code: "invalid_type" }),
    ]));
  });

  it("calls next with ValidationError on invalid query", () => {
    const mw = validate(schema);
    const req = {
      body: { name: "John" },
      query: { limit: "not-a-number" },
      params: { id: "123" },
    } as unknown as Request;

    mw(req, mockResponse(), mockNext);

    const firstCall = mockNext.mock.calls[0];
    if (!firstCall) throw new Error("Next not called");
    const error = firstCall[0] as { name: string; details: unknown[] };
    expect(error.name).toBe("ValidationError");
    expect(error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "query.limit" }),
    ]));
  });

  it("handles missing body/query/params schemas", () => {
    const partialSchema = { body: z.object({ name: z.string() }) };
    const mw = validate(partialSchema);
    const req = {
      body: { name: "John" },
      query: { something: "else" },
    } as unknown as Request;

    mw(req, mockResponse(), mockNext);

    expect(mockNext).toHaveBeenCalledWith();
    expect(req.query).toEqual({ something: "else" }); // unchanged
  });

  it("uses Object.defineProperty for query and params (Express 5 compatibility)", () => {
    const mw = validate(schema);
    const req = {
      body: { name: "John" },
      query: { limit: "10" },
      params: { id: "456" },
    } as unknown as Request;

    // Ensure they are redefined
    mw(req, mockResponse(), mockNext);

    const queryDesc = Object.getOwnPropertyDescriptor(req, "query");
    const paramsDesc = Object.getOwnPropertyDescriptor(req, "params");

    expect(queryDesc?.writable).toBe(true);
    expect(paramsDesc?.writable).toBe(true);
    const queryData = req.query as unknown as { limit: number };
    expect(queryData.limit).toBe(10);
    expect(req.params.id).toBe("456");
  });
});

