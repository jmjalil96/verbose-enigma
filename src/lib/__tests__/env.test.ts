import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const originalEnv = { ...process.env };

function setBaseRequiredEnv() {
  // Required by env schema
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/verbose_enigma_test";

  // Keep tests quiet/stable
  process.env.LOG_LEVEL = "silent";
}

describe("env", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    setBaseRequiredEnv();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();

    await expect(import("../env.js")).rejects.toThrow(
      /Invalid environment variables/i,
    );
  });

  it("transforms TRUST_PROXY to boolean", async () => {
    process.env.TRUST_PROXY = "true";
    vi.resetModules();

    const { env } = await import("../env.js");
    expect(env.TRUST_PROXY).toBe(true);
  });

  it("applies defaults for optional values", async () => {
    // Ensure defaults are used (when not provided)
    delete process.env.PORT;
    delete process.env.RATE_LIMIT_WINDOW_MS;
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.REQUEST_TIMEOUT_MS;
    delete process.env.REQUEST_BODY_LIMIT;
    delete process.env.SESSION_COOKIE_NAME;
    delete process.env.EMAIL_PROVIDER;
    delete process.env.EMAIL_FROM;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.APP_URL;
    delete process.env.CORS_ORIGIN;
    delete process.env.TRUST_PROXY;

    vi.resetModules();
    const { env } = await import("../env.js");

    expect(env.PORT).toBe(3000);
    expect(env.TRUST_PROXY).toBe(false);
    expect(env.RATE_LIMIT_WINDOW_MS).toBe(60000);
    expect(env.RATE_LIMIT_MAX).toBe(100);
    expect(env.REQUEST_TIMEOUT_MS).toBe(30000);
    expect(env.REQUEST_BODY_LIMIT).toBe("100kb");
    expect(env.SESSION_COOKIE_NAME).toBe("session");

    expect(env.EMAIL_PROVIDER).toBe("smtp");
    expect(env.EMAIL_FROM).toBe("noreply@example.com");
    expect(env.SMTP_HOST).toBe("localhost");
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.APP_URL).toBe("http://localhost:3000");

    expect(env.CORS_ORIGIN).toBe("*");
  });
});


