// API 기본 URL 설정
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

// 공통 fetcher 함수
export const fetcher = async (endpoint: string, options?: RequestInit) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  if (!response.ok) {
    throw new Error("API 호출 에러");
  }
  return response.json();
};

// 회원가입 API
export async function signup(data: { email: string; password: string; nickname: string }) {
  return fetcher("/users/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// 로그인 API
export async function login(data: { email: string; password: string }) {
  return fetcher("/users/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
