import { config } from "dotenv";
import { afterAll } from "vitest";

// Load test environment before anything else
config({ path: ".env.test" });

// Now import db (after env is loaded)
const { db } = await import("../lib/db.js");

afterAll(async () => {
  await db.$disconnect();
});
