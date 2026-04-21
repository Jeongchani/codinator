import type { SocialProvider } from '@prisma/client';

/**
 * 각 소셜 Provider 검증 후 반환하는 표준화 프로필.
 * auth.service.ts 는 이 타입만 의존하며 Provider 별 응답 구조에 직접 의존하지 않는다.
 */
export interface SocialUserProfile {
  provider: SocialProvider;
  /** Provider 측 고유 사용자 식별자 (social_accounts.provider_user_id) */
  providerUserId: string;
  providerEmail?: string | null;
  emailVerified?: boolean | null;
  name?: string | null;
  nickname?: string | null;
  profileImageUrl?: string | null;
}

export interface SocialProviderVerifier {
  /**
   * @param providerToken Provider별 토큰
   *   - GOOGLE : ID token
   *   - KAKAO  : access token
   *   - NAVER  : access token
   * @throws UnauthorizedException  토큰 무효 / 만료 / 식별자 누락
   * @throws BadGatewayException    Provider 서버 일시 장애 / 네트워크 오류
   */
  verify(providerToken: string): Promise<SocialUserProfile>;
}
