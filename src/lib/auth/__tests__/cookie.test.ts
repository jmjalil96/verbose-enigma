import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalEnv = { ...process.env };

function createMockRes() {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };
}

describe("auth cookie helpers", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/verbose_enigma_test";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("setSessionCookie uses SESSION_COOKIE_NAME and sets expected options", async () => {
    process.env.SESSION_COOKIE_NAME = "my_session";
    process.env.NODE_ENV = "test";
    vi.resetModules();

    const { setSessionCookie } = await import("../cookie.js");
    const res = createMockRes();
    const expiresAt = new Date("2030-01-01T00:00:00Z");

    setSessionCookie(res as never, "token-123", expiresAt);

    expect(res.cookie).toHaveBeenCalledWith(
      "my_session",
      "token-123",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
        expires: expiresAt,
      }),
    );
  });

  it("setSessionCookie sets secure=true in production", async () => {
    process.env.SESSION_COOKIE_NAME = "session";
    process.env.NODE_ENV = "production";
    vi.resetModules();

    const { setSessionCookie } = await import("../cookie.js");
    const res = createMockRes();
    const expiresAt = new Date("2030-01-01T00:00:00Z");

    setSessionCookie(res as never, "token-123", expiresAt);

    expect(res.cookie).toHaveBeenCalledWith(
      "session",
      "token-123",
      expect.objectContaining({
        secure: true,
      }),
    );
  });

  it("clearSessionCookie clears with the same cookie options", async () => {
    process.env.SESSION_COOKIE_NAME = "my_session";
    process.env.NODE_ENV = "test";
    vi.resetModules();

    const { clearSessionCookie } = await import("../cookie.js");
    const res = createMockRes();

    clearSessionCookie(res as never);

    expect(res.clearCookie).toHaveBeenCalledWith(
      "my_session",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      }),
    );
  });
});


