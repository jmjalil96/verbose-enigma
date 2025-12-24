/**
 * Add days to a date.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Apply date range filter to where clause.
 * Uses inclusive from, exclusive to (end-of-day semantics).
 */
export function applyDateRange(
  where: Record<string, unknown>,
  field: string,
  from?: Date,
  to?: Date,
): void {
  if (from || to) {
    where[field] = {
      ...(from && { gte: from }),
      ...(to && { lt: addDays(to, 1) }),
    };
  }
}

/**
 * Apply number range filter to where clause.
 */
export function applyNumberRange(
  where: Record<string, unknown>,
  field: string,
  min?: number,
  max?: number,
): void {
  if (min !== undefined || max !== undefined) {
    where[field] = {
      ...(min !== undefined && { gte: min }),
      ...(max !== undefined && { lte: max }),
    };
  }
}
