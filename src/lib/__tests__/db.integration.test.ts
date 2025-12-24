import { describe, it, expect, afterAll } from "vitest";
import { connectDb, disconnectDb, db } from "../db.js";

describe("Database Infrastructure (integration)", () => {
  afterAll(async () => {
    // Ensure we are connected at the end so other tests don't fail if they run after
    try {
      await connectDb();
    } catch {
      // ignore
    }
  });

  it("successfully connects to the database", async () => {
    // Should not throw
    await expect(connectDb()).resolves.not.toThrow();
  });

  it("successfully performs a raw query", async () => {
    const result = await db.$queryRaw`SELECT 1 as val`;
    expect(result).toEqual([{ val: 1 }]);
  });

  it("successfully disconnects from the database", async () => {
    // Should not throw
    await expect(disconnectDb()).resolves.not.toThrow();
    
    // Attempting a query after disconnect should fail (or re-connect if prisma handles it, 
    // but $disconnect is intended to close it)
    // Actually, Prisma Client usually auto-reconnects on the next query.
    // We just want to test that disconnectDb itself works without error.
  });
});

