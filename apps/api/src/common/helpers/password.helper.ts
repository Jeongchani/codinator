/**
 * 비밀번호 정책 검증 헬퍼
 * - 최소 8자
 * - 영문(대소문자 구분 없음) 1자 이상
 * - 숫자 1자 이상
 * - 특수문자 1자 이상
 */
export function isValidPassword(password: string): boolean {
  return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password);
}
