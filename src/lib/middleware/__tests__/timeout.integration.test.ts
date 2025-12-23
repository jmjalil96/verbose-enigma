import express from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

describe("timeoutMiddleware", () => {
  it("returns REQUEST_TIMEOUT error when handler does not respond in time", async () => {
    // Ensure a fresh env read (env is parsed at import time)
    process.env.REQUEST_TIMEOUT_MS = "1";
    vi.resetModules();

    const { applyMiddleware } = await import("../index.js");
    const { errorHandler } = await import("../../errors/index.js");

    const app = express();
    applyMiddleware(app);

    // Route that never responds
    app.get("/slow", (_req, _res) => {
      // Intentionally do nothing
    });

    app.use(errorHandler);

    const res = await request(app).get("/slow");

    expect(res.status).toBe(408);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("REQUEST_TIMEOUT");
    expect(res.body.requestId).toBeDefined();
    expect(res.body.errorId).toBeDefined();
  });
});


