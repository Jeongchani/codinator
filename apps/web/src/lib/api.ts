// 향후 모든 API 호출은 이 설정을 거치게 됩니다.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const fetcher = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
//http://localhost:3000/api/v1/users/seed-check
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'API 호출 에러');
  }

  return response.json() as Promise<T>;
};