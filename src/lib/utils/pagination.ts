import type { OffsetPaginatedResponse } from "../../types/pagination.js";

/**
 * Build offset pagination response from query results.
 *
 * @param items - Items fetched from DB
 * @param page - Current page number (1-based)
 * @param limit - Page size
 * @param total - Total count of matching items
 */
export function buildOffsetPagination<T>(
  items: T[],
  page: number,
  limit: number,
  total: number,
): OffsetPaginatedResponse<T> {
  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
