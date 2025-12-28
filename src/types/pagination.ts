export interface OffsetPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface OffsetPaginatedResponse<T> {
  data: T[];
  pagination: OffsetPaginationMeta;
}
