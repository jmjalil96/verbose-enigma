import { describe, it, expect } from "vitest";
import { addDays, applyDateRange, applyNumberRange } from "../query.js";

describe("Query Utils", () => {
  describe("addDays", () => {
    it("adds days to a date", () => {
      const date = new Date("2025-01-01");
      const result = addDays(date, 5);
      expect(result.toISOString()).toBe(new Date("2025-01-06").toISOString());
    });

    it("subtracts days if negative", () => {
      const date = new Date("2025-01-05");
      const result = addDays(date, -2);
      expect(result.toISOString()).toBe(new Date("2025-01-03").toISOString());
    });
  });

  describe("applyDateRange", () => {
    it("does nothing if no dates provided", () => {
      const where: Record<string, unknown> = {};
      applyDateRange(where, "createdAt");
      expect(where).toEqual({});
    });

    it("applies gte for from date", () => {
      const where: Record<string, unknown> = {};
      const from = new Date("2025-01-01");
      applyDateRange(where, "createdAt", from);
      expect(where.createdAt).toEqual({ gte: from });
    });

    it("applies lt (inclusive end-of-day) for to date", () => {
      const where: Record<string, unknown> = {};
      const to = new Date("2025-01-01");
      applyDateRange(where, "createdAt", undefined, to);
      // to date 2025-01-01 should result in lt 2025-01-02
      const filter = where.createdAt as { lt: Date };
      expect(filter.lt.toISOString()).toBe(new Date("2025-01-02").toISOString());
    });

    it("applies both from and to dates", () => {
      const where: Record<string, unknown> = {};
      const from = new Date("2025-01-01");
      const to = new Date("2025-01-05");
      applyDateRange(where, "createdAt", from, to);
      const filter = where.createdAt as { gte: Date; lt: Date };
      expect(filter.gte).toEqual(from);
      expect(filter.lt.toISOString()).toBe(new Date("2025-01-06").toISOString());
    });
  });

  describe("applyNumberRange", () => {
    it("does nothing if no numbers provided", () => {
      const where: Record<string, unknown> = {};
      applyNumberRange(where, "amount");
      expect(where).toEqual({});
    });

    it("applies gte for min value", () => {
      const where: Record<string, unknown> = {};
      applyNumberRange(where, "amount", 100);
      expect(where.amount).toEqual({ gte: 100 });
    });

    it("applies lte for max value", () => {
      const where: Record<string, unknown> = {};
      applyNumberRange(where, "amount", undefined, 500);
      expect(where.amount).toEqual({ lte: 500 });
    });

    it("applies both min and max values", () => {
      const where: Record<string, unknown> = {};
      applyNumberRange(where, "amount", 100, 500);
      expect(where.amount).toEqual({ gte: 100, lte: 500 });
    });

    it("handles zero correctly", () => {
      const where: Record<string, unknown> = {};
      applyNumberRange(where, "amount", 0, 0);
      expect(where.amount).toEqual({ gte: 0, lte: 0 });
    });
  });
});


