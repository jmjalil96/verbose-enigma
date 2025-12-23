import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { app } from "../../../test/app.js";
import {
  cleanupAuthTestData,
  createAuthTestPrefix,
  createEmployeeProfile,
  createRole,
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

describe("Auth - invitations", () => {
  const prefix = createAuthTestPrefix("invite");
  const password = "CorrectHorseBatteryStaple1!";
  let inviterRoleWithPerm: { id: string };
  let inviterRoleNoPerm: { id: string };
  let inviteeRole: { id: string };
  let inviterWithPerm: { id: string; email: string };
  let inviterNoPerm: { id: string; email: string };

  beforeAll(async () => {
    inviterRoleWithPerm = await createRole(prefix, { withInvitePerm: true });
    inviterRoleNoPerm = await createRole(prefix, { withInvitePerm: false });
    inviteeRole = await createRole(prefix, { withInvitePerm: false });

    inviterWithPerm = await createUserWithPassword({
      prefix,
      roleId: inviterRoleWithPerm.id,
      password,
    });
    inviterNoPerm = await createUserWithPassword({
      prefix,
      roleId: inviterRoleNoPerm.id,
      password,
    });
  });

  afterAll(async () => {
    await cleanupAuthTestData(prefix);
  });

  beforeEach(() => {
    enqueueMock.mockClear();
  });

  it("POST /api/auth/invitations returns 403 without users:invite permission", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: inviterNoPerm.email, password });

    const employee = await createEmployeeProfile({ prefix });

    const res = await agent.post("/api/auth/invitations").send({
      roleId: inviteeRole.id,
      employeeId: employee.id,
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("Create → validate → accept invitation (happy path)", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: inviterWithPerm.email, password });

    const employee = await createEmployeeProfile({ prefix });

    const createRes = await agent.post("/api/auth/invitations").send({
      roleId: inviteeRole.id,
      employeeId: employee.id,
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.invitationId).toBeDefined();
    expect(typeof createRes.body.expiresAt).toBe("string");
    expect(enqueueMock).toHaveBeenCalledTimes(1);

    const enqueueArgs = enqueueMock.mock.calls[0];
    const payload = enqueueArgs?.[1] as { invitationId: string; token: string };
    expect(payload.invitationId).toBe(createRes.body.invitationId);
    expect(typeof payload.token).toBe("string");

    const token = payload.token;

    const validateRes = await request(app).get(`/api/auth/invitations/${token}`);
    expect(validateRes.status).toBe(200);
    expect(validateRes.body.expiresAt).toBeDefined();
    expect(validateRes.body.role?.displayName).toBeDefined();

    const acceptRes = await request(app)
      .post("/api/auth/invitations/accept")
      .send({ token, password: "NewPassword123!" });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.headers["set-cookie"]).toBeDefined();
    expect(acceptRes.body.user).toBeDefined();
    expect(acceptRes.body.user.role.id).toBe(inviteeRole.id);

    // Token should now be invalid/expired
    const validateAgain = await request(app).get(`/api/auth/invitations/${token}`);
    expect(validateAgain.status).toBe(404);

    // Accept again should not work
    const acceptAgain = await request(app)
      .post("/api/auth/invitations/accept")
      .send({ token, password: "AnotherPassword123!" });
    expect(acceptAgain.status).toBe(404);
  });

  it("Resend rotates token: old token invalid, new token valid", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: inviterWithPerm.email, password });

    const employee = await createEmployeeProfile({ prefix });

    const createRes = await agent.post("/api/auth/invitations").send({
      roleId: inviteeRole.id,
      employeeId: employee.id,
    });
    expect(createRes.status).toBe(201);

    const firstPayload = enqueueMock.mock.calls[0]?.[1] as {
      invitationId: string;
      token: string;
    };
    const invitationId = firstPayload.invitationId;
    const token1 = firstPayload.token;

    const resendRes = await agent.post(`/api/auth/invitations/${invitationId}/resend`);
    expect(resendRes.status).toBe(200);
    expect(enqueueMock).toHaveBeenCalledTimes(2);

    const secondPayload = enqueueMock.mock.calls[1]?.[1] as {
      invitationId: string;
      token: string;
    };
    const token2 = secondPayload.token;
    expect(secondPayload.invitationId).toBe(invitationId);
    expect(token2).not.toBe(token1);

    // Old token invalid
    const oldValidate = await request(app).get(`/api/auth/invitations/${token1}`);
    expect(oldValidate.status).toBe(404);

    // New token valid
    const newValidate = await request(app).get(`/api/auth/invitations/${token2}`);
    expect(newValidate.status).toBe(200);
  });
});


