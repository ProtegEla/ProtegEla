/**
 * Tipos padronizados de resposta e erro da API ProtegEla.
 */

export interface ApiErrorDetail {
  field?: string;
  issue: string;
  type?: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  status_code: number;
  timestamp: string;
  details?: ApiErrorDetail[];
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    page_size?: number;
    total_records?: number;
  };
}
