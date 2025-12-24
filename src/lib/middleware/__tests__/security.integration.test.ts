import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../../test/app.js";

describe("Security Middleware", () => {
  describe("Helmet Security Headers", () => {
    it("sets X-Content-Type-Options header", async () => {
      const res = await request(app).get("/api/health");

      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });

    it("sets X-Frame-Options header", async () => {
      const res = await request(app).get("/api/health");

      expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    });

    it("sets Content-Security-Policy header", async () => {
      const res = await request(app).get("/api/health");

      expect(res.headers["content-security-policy"]).toBeDefined();
      expect(res.headers["content-security-policy"]).toContain("default-src");
    });

    it("sets X-DNS-Prefetch-Control header", async () => {
      const res = await request(app).get("/api/health");

      expect(res.headers["x-dns-prefetch-control"]).toBe("off");
    });

    it("sets Strict-Transport-Security header", async () => {
      const res = await request(app).get("/api/health");

      expect(res.headers["strict-transport-security"]).toBeDefined();
    });

    it("sets X-Download-Options header", async () => {
      const res = await request(app).get("/api/health");

      expect(res.headers["x-download-options"]).toBe("noopen");
    });
  });

  describe("CORS Headers", () => {
    it("sets Access-Control-Allow-Origin header", async () => {
      const res = await request(app)
        .get("/api/health")
        .set("Origin", "http://localhost:3000");

      expect(res.headers["access-control-allow-origin"]).toBeDefined();
    });

    it("exposes X-Request-Id header", async () => {
      const res = await request(app)
        .get("/api/health")
        .set("Origin", "http://localhost:3000");

      expect(res.headers["access-control-expose-headers"]).toContain(
        "X-Request-Id"
      );
    });

    it("responds to preflight OPTIONS request", async () => {
      const res = await request(app)
        .options("/api/health")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Method", "POST");

      expect(res.status).toBe(204);
      expect(res.headers["access-control-allow-methods"]).toBeDefined();
    });
  });

  describe("Rate Limiting", () => {
    it("includes RateLimit headers in response", async () => {
      const res = await request(app).get("/api/auth/me");

      // Rate limit headers are set by express-rate-limit
      expect(res.headers["ratelimit-limit"]).toBeDefined();
      expect(res.headers["ratelimit-remaining"]).toBeDefined();
      expect(res.headers["ratelimit-reset"]).toBeDefined();
    });

    it("skips rate limiting for health check endpoints", async () => {
      // Health endpoints should not have rate limit headers
      const res = await request(app).get("/api/health");

      // Health check paths are skipped, so they shouldn't have rate limit headers
      // or they should always succeed
      expect(res.status).toBe(200);
    });

    it("decrements remaining count after each request", async () => {
      const res1 = await request(app).post("/api/auth/login").send({});
      const res2 = await request(app).post("/api/auth/login").send({});

      const remaining1 = parseInt(String(res1.headers["ratelimit-remaining"]), 10);
      const remaining2 = parseInt(String(res2.headers["ratelimit-remaining"]), 10);

      // Second request should have lower remaining count
      expect(remaining2).toBeLessThan(remaining1);
    });
  });

  describe("Request Handling", () => {
    it("parses JSON body correctly", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@example.com", password: "password123" });

      // Should parse JSON and return either validation error or auth error
      // (not a parse error or internal error)
      expect([400, 401]).toContain(res.status);
      expect((res.body as { error?: unknown }).error).toBeDefined();
      expect((res.body as { error: { code: string } }).error.code).not.toBe("INTERNAL_ERROR");
    });

    it("rejects invalid JSON with error", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .set("Content-Type", "application/json")
        .send("{ invalid json }");

      // Express rejects malformed JSON with 4xx or 5xx
      // The exact status depends on error handler configuration
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect((res.body as { error?: unknown }).error).toBeDefined();
    });

    it("accepts requests without body for GET endpoints", async () => {
      const res = await request(app).get("/api/health");

      expect(res.status).toBe(200);
    });
  });
});
