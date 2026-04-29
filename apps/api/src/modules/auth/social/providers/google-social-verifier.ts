import { BadGatewayException, Injectable, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import { SocialProvider } from '@prisma/client';
import type { SocialProviderVerifier, SocialUserProfile } from '../social-provider-verifier.interface';

/** https://developers.google.com/identity/openid-connect/openid-connect#obtainuserinfo */
interface GoogleTokenInfoResponse {
  iss: string;          // accounts.google.com | https://accounts.google.com
  aud: string;          // client_id
  sub: string;          // providerUserId
  email?: string;
  email_verified?: string; // 'true' | 'false'
  name?: string;
  picture?: string;
  exp: string;          // unix timestamp (string)
  error_description?: string;
}

/**
 * Google ID token 검증기.
 *
 * - 실제 검증: Google tokeninfo endpoint 사용 (서명 + exp 자동 처리)
 * - aud(client_id) 검증: GOOGLE_CLIENT_ID env 설정 시에만
 * - mock/stub 전략 완전 제거 — real provider verification 만 허용
 */
@Injectable()
export class GoogleSocialVerifier implements SocialProviderVerifier {
  private readonly clientId = process.env.GOOGLE_CLIENT_ID ?? '';

  async verify(providerToken: string): Promise<SocialUserProfile> {
    let tokenInfo: GoogleTokenInfoResponse;

    try {
      const { data } = await axios.get<GoogleTokenInfoResponse>(
        'https://oauth2.googleapis.com/tokeninfo',
        {
          params: { id_token: providerToken },
          timeout: 10_000,
        },
      );
      tokenInfo = data;
    } catch (err: any) {
      if (err.response?.status === 400) {
        // Google 이 400 으로 토큰 무효/만료를 알림
        throw new UnauthorizedException(
          err.response.data?.error_description ?? '유효하지 않은 Google ID token 입니다.',
        );
      }
      throw new BadGatewayException(
        'Google 인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
      );
    }

    // iss 검증
    const validIss = ['accounts.google.com', 'https://accounts.google.com'];
    if (!validIss.includes(tokenInfo.iss)) {
      throw new UnauthorizedException('유효하지 않은 Google ID token 입니다. (iss 불일치)');
    }

    // aud 검증 (GOOGLE_CLIENT_ID 환경변수 설정 시에만 적용)
    if (this.clientId && tokenInfo.aud !== this.clientId) {
      throw new UnauthorizedException('유효하지 않은 Google ID token 입니다. (aud 불일치)');
    }

    // sub (providerUserId) 존재 확인
    if (!tokenInfo.sub) {
      throw new UnauthorizedException('Google 사용자 식별자(sub)를 확인할 수 없습니다.');
    }

    return {
      provider: SocialProvider.GOOGLE,
      providerUserId: tokenInfo.sub,
      providerEmail: tokenInfo.email ?? null,
      emailVerified: tokenInfo.email_verified === 'true',
      name: tokenInfo.name ?? null,
      profileImageUrl: tokenInfo.picture ?? null,
    };
  }
}
