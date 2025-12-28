import { db } from "../db.js";

export async function findSessionByTokenHash(tokenHash: string) {
  return db.session.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
      lastActiveAt: true,
      user: {
        select: {
          id: true,
          email: true,
          emailVerifiedAt: true,
          isActive: true,
          sessionsInvalidBefore: true,
          role: {
            select: {
              id: true,
              name: true,
              scopeType: true,
              permissions: {
                select: {
                  permission: {
                    select: {
                      resource: true,
                      action: true,
                    },
                  },
                },
              },
            },
          },
          employee: { select: { firstName: true, lastName: true } },
          agent: { select: { firstName: true, lastName: true } },
          clientAdmin: { select: { firstName: true, lastName: true } },
          affiliate: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
}

export async function updateSessionLastActive(sessionId: string) {
  return db.session.update({
    where: { id: sessionId },
    data: { lastActiveAt: new Date() },
  });
}
