export interface CursorPaginationMeta<TCursor = number> {
  nextCursor: TCursor | null;
  hasMore: boolean;
  total?: number;
}

export interface PaginatedResponse<T, TCursor = number> {
  data: T[];
  pagination: CursorPaginationMeta<TCursor>;
}
