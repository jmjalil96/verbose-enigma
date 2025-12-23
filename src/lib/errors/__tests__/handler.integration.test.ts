import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../../test/app.js";

describe("Error Handler", () => {
  describe("404 Not Found", () => {
    it("returns 404 for unknown routes", async () => {
      const res = await request(app).get("/unknown-route");

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe("NOT_FOUND");
      expect(res.body.error.message).toBe("Resource not found");
    });

    it("includes requestId in response", async () => {
      const res = await request(app).get("/unknown-route");

      expect(res.body.requestId).toBeDefined();
      expect(typeof res.body.requestId).toBe("string");
      expect(res.body.requestId.length).toBeGreaterThan(0);
    });

    it("includes errorId in response", async () => {
      const res = await request(app).get("/unknown-route");

      expect(res.body.errorId).toBeDefined();
      expect(typeof res.body.errorId).toBe("string");
      expect(res.body.errorId.length).toBeGreaterThan(0);
    });
  });

  describe("Validation Errors", () => {
    it("returns 400 with VALIDATION_ERROR code for invalid body", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "not-an-email" }); // Missing password, invalid email

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Validation failed");
    });

    it("includes details array with field paths prefixed with body.*", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "not-an-email" });

      expect(res.body.error.details).toBeDefined();
      expect(Array.isArray(res.body.error.details)).toBe(true);
      expect(res.body.error.details.length).toBeGreaterThan(0);

      // Check that fields are prefixed with "body."
      const fields = res.body.error.details.map(
        (d: { field: string }) => d.field
      );
      expect(fields.some((f: string) => f.startsWith("body."))).toBe(true);
    });

    it("includes validation error details with field, message, and code", async () => {
      const res = await request(app).post("/api/auth/login").send({});

      expect(res.body.error.details).toBeDefined();
      const detail = res.body.error.details[0];
      expect(detail).toHaveProperty("field");
      expect(detail).toHaveProperty("message");
      expect(detail).toHaveProperty("code");
    });
  });

  describe("Request ID Handling", () => {
    it("returns X-Request-Id header in response", async () => {
      const res = await request(app).get("/api/health");

      expect(res.headers["x-request-id"]).toBeDefined();
      expect(typeof res.headers["x-request-id"]).toBe("string");
    });

    it("echoes X-Request-Id when provided in request", async () => {
      const customRequestId = "test-request-id-12345";
      const res = await request(app)
        .get("/api/health")
        .set("X-Request-Id", customRequestId);

      expect(res.headers["x-request-id"]).toBe(customRequestId);
    });

    it("generates unique request ID when not provided", async () => {
      const res1 = await request(app).get("/api/health");
      const res2 = await request(app).get("/api/health");

      expect(res1.headers["x-request-id"]).not.toBe(
        res2.headers["x-request-id"]
      );
    });

    it("uses echoed request ID in error response body", async () => {
      const customRequestId = "error-request-id-99999";
      const res = await request(app)
        .get("/unknown-route")
        .set("X-Request-Id", customRequestId);

      expect(res.body.requestId).toBe(customRequestId);
    });
  });

  describe("Health Endpoints", () => {
    it("GET /api/health returns 200 with status ok", async () => {
      const res = await request(app).get("/api/health");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });

    it("GET /live returns 200 with status ok", async () => {
      const res = await request(app).get("/live");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });

    it("GET /ready returns 200 when database is available", async () => {
      const res = await request(app).get("/ready");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });
  });
});
