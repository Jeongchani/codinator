import { BadGatewayException, Injectable, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import { SocialProvider } from '@prisma/client';
import type { SocialProviderVerifier, SocialUserProfile } from '../social-provider-verifier.interface';

/** https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#req-user-info */
interface KakaoUserMeResponse {
  id: number;
  kakao_account?: {
    email?: string;
    is_email_verified?: boolean;
    is_email_valid?: boolean;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
}

/**
 * Kakao access token 검증기.
 *
 * - 실제 검증: GET https://kapi.kakao.com/v2/user/me (Bearer access token)
 * - providerUserId: kakao id (number → string 변환)
 * - email, is_email_verified: kakao_account 동의항목 허용 시에만 존재
 * - emailVerified: is_email_verified && is_email_valid 모두 true 일 때만 true
 * - mock/stub 전략 완전 제거 — real provider verification 만 허용
 */
@Injectable()
export class KakaoSocialVerifier implements SocialProviderVerifier {
  async verify(providerToken: string): Promise<SocialUserProfile> {
    let data: KakaoUserMeResponse;

    try {
      const response = await axios.get<KakaoUserMeResponse>(
        'https://kapi.kakao.com/v2/user/me',
        {
          headers: { Authorization: `Bearer ${providerToken}` },
          timeout: 10_000,
        },
      );
      data = response.data;
    } catch (err: unknown) {
  const status = axios.isAxiosError<KakaoUserMeResponse>(err)
    ? err.response?.status
    : undefined;
  const body = axios.isAxiosError<KakaoUserMeResponse>(err)
    ? err.response?.data
    : undefined;

  console.error('[KakaoVerifier] status:', status, 'body:', JSON.stringify(body));

  if (status === 401 || status === 403) {
    throw new UnauthorizedException('유효하지 않거나 만료된 Kakao access token 입니다.');
  }

  throw new BadGatewayException(
    'Kakao 인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  );
}

    if (!data.id) {
      throw new UnauthorizedException('Kakao 사용자 식별자(id)를 확인할 수 없습니다.');
    }

    const account = data.kakao_account;

    // emailVerified: is_email_verified 와 is_email_valid 모두 true 여야 신뢰 가능
    const emailVerified =
      account?.is_email_verified === true && account?.is_email_valid === true
        ? true
        : account?.is_email_verified === false || account?.is_email_valid === false
          ? false
          : null; // 동의항목 미허용 등으로 정보 없음

    return {
      provider: SocialProvider.KAKAO,
      providerUserId: String(data.id),
      providerEmail: account?.email ?? null,
      emailVerified,
      nickname: account?.profile?.nickname ?? null,
      profileImageUrl: account?.profile?.profile_image_url ?? null,
    };
  }
}
