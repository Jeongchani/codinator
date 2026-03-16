//공통 에러 응답 타입
export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
}

