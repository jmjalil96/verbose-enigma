import { defineConfig } from "vitest/config";

export default defineConfig({
  poolOptions: {
    threads: {
      minThreads: 1,
      maxThreads: 1,
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 10000,
    sequence: {
      concurrent: false, // Run tests sequentially to avoid DB conflicts
    },
  },
});
