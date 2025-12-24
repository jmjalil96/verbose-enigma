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
vi.mock("../../../lib/jobs/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/jobs/index.js")>();
  return { ...actual, enqueue: enqueueMock };
});

const { logAuditMock } = vi.hoisted(() => ({ logAuditMock: vi.fn() }));
vi.mock("../../../services/audit/index.js", () => ({ logAudit: logAuditMock }));

describe("Auth - sessions", () => {
  const prefix = createAuthTestPrefix("session");
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

  it("POST /api/auth/login succeeds and sets cookie", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password });

    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]).toBeDefined();
    const setCookie = res.headers["set-cookie"];
    expect(Array.isArray(setCookie)).toBe(true);
    expect(setCookie?.[0]).toContain("session=");
    expect((res.body as { user: { id: string } }).user).toBeDefined();
    expect((res.body as { user: { id: string } }).user.id).toBe(user.id);
    expect(typeof (res.body as { expiresAt: string }).expiresAt).toBe("string");
  });

  it("POST /api/auth/login returns 401 for unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: `${prefix}-unknown@example.com`, password });

    expect(res.status).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
    expect((res.body as { error: { message: string } }).error.message).toBe("Invalid credentials");
  });

  it("POST /api/auth/login returns 401 for bad password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
  });

  it("POST /api/auth/login returns 401 for inactive user", async () => {
    const inactive = await createUserWithPassword({
      prefix,
      roleId: role.id,
      password,
      isActive: false,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: inactive.email, password });

    expect(res.status).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
  });

  it("GET /api/auth/me returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
  });

  it("GET /api/auth/me returns user info when authenticated and omits session", async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post("/api/auth/login")
      .send({ email: user.email, password });
    expect(loginRes.status).toBe(200);

    const meRes = await agent.get("/api/auth/me");
    expect(meRes.status).toBe(200);
    expect(meRes.headers["cache-control"]).toContain("no-store");
    expect((meRes.body as { id: string }).id).toBe(user.id);
    expect((meRes.body as { email: string }).email).toBe(user.email);
    expect(meRes.body).not.toHaveProperty("session");
  });

  it("POST /api/auth/logout clears cookie and invalidates session", async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post("/api/auth/login")
      .send({ email: user.email, password });
    expect(loginRes.status).toBe(200);

    const logoutRes = await agent.post("/api/auth/logout");
    expect(logoutRes.status).toBe(204);
    expect(logoutRes.headers["set-cookie"]).toBeDefined();

    const meRes = await agent.get("/api/auth/me");
    expect(meRes.status).toBe(401);
  });

  it("POST /api/auth/logout-all invalidates all user sessions", async () => {
    // Create two sessions for the user; use one cookie to call logout-all.
    const { cookie: cookie1 } = await createSessionCookie({ userId: user.id });
    const { cookie: cookie2 } = await createSessionCookie({ userId: user.id });

    const pre = await request(app).get("/api/auth/me").set("Cookie", cookie2);
    expect(pre.status).toBe(200);

    const res = await request(app)
      .post("/api/auth/logout-all")
      .set("Cookie", cookie1);
    expect(res.status).toBe(204);

    const post1 = await request(app).get("/api/auth/me").set("Cookie", cookie1);
    expect(post1.status).toBe(401);

    const post2 = await request(app).get("/api/auth/me").set("Cookie", cookie2);
    expect(post2.status).toBe(401);

    // sanity: sessionsInvalidBefore set
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { sessionsInvalidBefore: true },
    });
    expect(dbUser?.sessionsInvalidBefore).not.toBeNull();
  });
});


