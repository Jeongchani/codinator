// 향후 모든 API 호출은 이 설정을 거치게 됩니다.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const fetcher = async (endpoint: string, options?: RequestInit) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  if (!response.ok) {
    throw new Error('API 호출 에러');
  }
  return response.json();
};