/**
 * Represents a single field change with before/after values.
 */
export interface FieldChange {
  from: unknown;
  to: unknown;
}

/**
 * Represents a set of changes between two objects.
 */
export interface ChangeSet {
  fields: string[];
  changes: Record<string, FieldChange>;
}

/**
 * Normalize value for comparison.
 * Converts Decimal objects to strings, handles null/undefined.
 */
function normalizeValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  // Handle Prisma Decimal (has toFixed method)
  if (typeof value === "object" && "toFixed" in value) {
    return (value as { toString(): string }).toString();
  }
  // Handle Date
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

/**
 * Check if two values are equal after normalization.
 */
function isEqual(a: unknown, b: unknown): boolean {
  const normA = normalizeValue(a);
  const normB = normalizeValue(b);

  // Handle null equality
  if (normA === null && normB === null) return true;
  if (normA === null || normB === null) return false;

  // Simple equality for primitives
  return normA === normB;
}

/**
 * Compute changes between an object and a partial update.
 * Only includes fields that actually changed.
 *
 * @param before - The original object state
 * @param patch - The partial update being applied
 * @returns ChangeSet with fields that changed and their from/to values
 */
export function computeChanges<T extends Record<string, unknown>>(
  before: T,
  patch: Partial<T>,
): ChangeSet {
  const fields: string[] = [];
  const changes: Record<string, FieldChange> = {};

  for (const key of Object.keys(patch)) {
    const oldValue = before[key];
    const newValue = patch[key];

    if (!isEqual(oldValue, newValue)) {
      fields.push(key);
      changes[key] = {
        from: normalizeValue(oldValue),
        to: normalizeValue(newValue),
      };
    }
  }

  return { fields, changes };
}
