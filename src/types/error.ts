export interface ErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[];
  };
  requestId: string;
  errorId: string;
}
