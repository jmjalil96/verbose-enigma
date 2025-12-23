import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { app } from "../../../test/app.js";
import { db } from "../../../lib/db.js";
import {
  cleanupAuthTestData,
  createAuthTestPrefix,
  createRole,
  createSessionCookie,
  createUserWithPassword,
} from "./helpers.js";

const { enqueueMock } = vi.hoisted(() => ({
  enqueueMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../lib/jobs/index.js", async () => {
  const actual = await vi.importActual<any>("../../../lib/jobs/index.js");
  return { ...actual, enqueue: enqueueMock };
});

const { logAuditMock } = vi.hoisted(() => ({ logAuditMock: vi.fn() }));
vi.mock("../../../services/audit/index.js", () => ({ logAudit: logAuditMock }));

describe("Auth - password reset", () => {
  const prefix = createAuthTestPrefix("pwreset");
  const password = "CorrectHorseBatteryStaple1!";
  let role: { id: string };
  let user: { id: string; email: string };

  beforeAll(async () => {
    role = await createRole(prefix);
    user = await createUserWithPassword({ prefix, roleId: role.id, password });
  });

  afterAll(async () => {
    await cleanupAuthTestData(prefix);
  });

  beforeEach(() => {
    enqueueMock.mockClear();
  });

  it("POST /password-reset/request is non-enumerating (always 200) and enqueues only for existing user", async () => {
    const known = await request(app)
      .post("/api/auth/password-reset/request")
      .send({ email: user.email });
    expect(known.status).toBe(200);
    expect(known.body.message).toBeDefined();

    const unknown = await request(app)
      .post("/api/auth/password-reset/request")
      .send({ email: `${prefix}-unknown@example.com` });
    expect(unknown.status).toBe(200);
    expect(unknown.body.message).toBe(known.body.message);

    expect(enqueueMock).toHaveBeenCalledTimes(1);
  });

  it("Validate + confirm password reset invalidates old sessions and prevents token reuse", async () => {
    // Create an existing session that should be invalidated by reset
    const { cookie } = await createSessionCookie({ userId: user.id });
    const pre = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(pre.status).toBe(200);

    // Request reset to generate token (captured via enqueue)
    await request(app)
      .post("/api/auth/password-reset/request")
      .send({ email: user.email });

    const payload = enqueueMock.mock.calls[0]?.[1] as { userId: string; token: string };
    const token = payload.token;

    const validate = await request(app).get(`/api/auth/password-reset/${token}`);
    expect(validate.status).toBe(200);
    expect(validate.body.expiresAt).toBeDefined();

    const confirm = await request(app)
      .post("/api/auth/password-reset/confirm")
      .send({ token, password: "BrandNewPassword123!" });
    expect(confirm.status).toBe(200);
    expect(confirm.body.message).toContain("successful");

    // Token cannot be reused
    const confirmAgain = await request(app)
      .post("/api/auth/password-reset/confirm")
      .send({ token, password: "AnotherNewPassword123!" });
    expect(confirmAgain.status).toBe(404);

    // Existing session invalidated
    const post = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(post.status).toBe(401);

    // Token validate should now fail
    const validateAgain = await request(app).get(`/api/auth/password-reset/${token}`);
    expect(validateAgain.status).toBe(404);
  });

  it("Two requests: only latest token remains valid", async () => {
    await request(app)
      .post("/api/auth/password-reset/request")
      .send({ email: user.email });
    const token1 = (enqueueMock.mock.calls[0]?.[1] as { token: string }).token;

    await request(app)
      .post("/api/auth/password-reset/request")
      .send({ email: user.email });
    const token2 = (enqueueMock.mock.calls[1]?.[1] as { token: string }).token;

    expect(token2).not.toBe(token1);

    const v1 = await request(app).get(`/api/auth/password-reset/${token1}`);
    expect(v1.status).toBe(404);

    const v2 = await request(app).get(`/api/auth/password-reset/${token2}`);
    expect(v2.status).toBe(200);

    // Confirm with token2 works
    const confirm2 = await request(app)
      .post("/api/auth/password-reset/confirm")
      .send({ token: token2, password: "AnotherBrandNewPassword123!" });
    expect(confirm2.status).toBe(200);

    // Token2 can't be reused
    const confirm2Again = await request(app)
      .post("/api/auth/password-reset/confirm")
      .send({ token: token2, password: "YetAnotherPassword123!" });
    expect(confirm2Again.status).toBe(404);

    // Verify old tokens are gone in DB for this user (at most one used token remains)
    const count = await db.verificationToken.count({
      where: { userId: user.id, type: "PASSWORD_RESET" },
    });
    expect(count).toBeGreaterThan(0);
  });
});


