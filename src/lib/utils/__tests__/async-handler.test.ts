import { describe, it, expect, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../async-handler.js";

describe("asyncHandler", () => {
  it("forwards rejected promise to next(err)", async () => {
    const err = new Error("boom");
    const handler = asyncHandler(async () => {
      throw err;
    });

    const next = vi.fn() as unknown as NextFunction;
    handler({} as Request, {} as Response, next);

    // allow promise rejection handler to run
    await Promise.resolve();

    expect(next).toHaveBeenCalledWith(err);
  });

  it("does not call next with error on resolve", async () => {
    const handler = asyncHandler(async () => {
      // ok
    });

    const next = vi.fn() as unknown as NextFunction;
    handler({} as Request, {} as Response, next);

    await Promise.resolve();

    // It may call next() in user handlers, but asyncHandler itself won't.
    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
  });
});


