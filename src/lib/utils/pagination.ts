import type { PaginatedResponse } from "../../types/pagination.js";

/**
 * Build cursor pagination response from query results.
 * Expects items fetched with `take: limit + 1` to detect hasMore.
 *
 * @param items - Items fetched from DB (with limit + 1)
 * @param limit - Requested page size
 * @param total - Optional total count of matching items
 */
export function buildCursorPagination<T extends { claimNumber: number }>(
  items: T[],
  limit: number,
  total?: number,
): PaginatedResponse<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const lastItem = data[data.length - 1];
  const nextCursor = hasMore && lastItem ? lastItem.claimNumber : null;

  return {
    data,
    pagination: {
      nextCursor,
      hasMore,
      ...(total !== undefined && { total }),
    },
  };
}

/**
 * Build cursor pagination response using `id` (cuid) as cursor.
 * Cuids are lexicographically sortable by creation time.
 * Expects items fetched with `take: limit + 1` to detect hasMore.
 *
 * @param items - Items fetched from DB (with limit + 1)
 * @param limit - Requested page size
 * @param total - Optional total count of matching items
 */
export function buildIdCursorPagination<T extends { id: string }>(
  items: T[],
  limit: number,
  total?: number,
): PaginatedResponse<T, string> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const lastItem = data[data.length - 1];
  const nextCursor = hasMore && lastItem ? lastItem.id : null;

  return {
    data,
    pagination: {
      nextCursor,
      hasMore,
      ...(total !== undefined && { total }),
    },
  };
}
