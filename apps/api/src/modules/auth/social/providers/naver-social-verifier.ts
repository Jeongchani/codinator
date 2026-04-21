import { BadGatewayException, Injectable, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import { createHash } from 'crypto';
import { SocialProvider } from '@prisma/client';
import type { SocialProviderVerifier, SocialUserProfile } from '../social-provider-verifier.interface';

/** https://developers.naver.com/docs/login/profile/profile.md */
interface NaverProfileResponse {
  resultcode: string; // '00' = 성공
  message: string;
  response: {
    id: string;
    email?: string;
    name?: string;
    nickname?: string;
    profile_image?: string;
  };
}

/**
 * Naver access token 검증기.
 *
 * - 실제 검증: GET https://openapi.naver.com/v1/nid/me (Bearer access token)
 * - providerUserId: response.id
 * - email: response.email (동의 시에만 존재)
 * - email_verified: Naver 는 제공하지 않으므로 null 처리
 * - dev fallback: NAVER_REAL_VERIFY_ENABLED / SOCIAL_LOGIN_REAL_VERIFY_ENABLED 모두 false 이면 stub
 */
@Injectable()
export class NaverSocialVerifier implements SocialProviderVerifier {
  private readonly realVerifyEnabled =
    process.env.NAVER_REAL_VERIFY_ENABLED === 'true' ||
    process.env.SOCIAL_LOGIN_REAL_VERIFY_ENABLED === 'true';

  async verify(providerToken: string): Promise<SocialUserProfile> {
    if (!this.realVerifyEnabled) {
      return this.stubProfile(providerToken);
    }

    let data: NaverProfileResponse;

    try {
      const response = await axios.get<NaverProfileResponse>(
        'https://openapi.naver.com/v1/nid/me',
        {
          headers: { Authorization: `Bearer ${providerToken}` },
          timeout: 10_000,
        },
      );
      data = response.data;
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        throw new UnauthorizedException('유효하지 않거나 만료된 Naver access token 입니다.');
      }
      throw new BadGatewayException(
        'Naver 인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
      );
    }

    if (data.resultcode !== '00' || !data.response?.id) {
      throw new UnauthorizedException('Naver 사용자 식별자(id)를 확인할 수 없습니다.');
    }

    const profile = data.response;

    return {
      provider: SocialProvider.NAVER,
      providerUserId: profile.id,
      providerEmail: profile.email ?? null,
      emailVerified: null, // Naver API 미제공
      name: profile.name ?? null,
      nickname: profile.nickname ?? null,
      profileImageUrl: profile.profile_image ?? null,
    };
  }

  private stubProfile(providerToken: string): SocialUserProfile {
    const providerUserId = createHash('sha256').update(providerToken).digest('hex').slice(0, 40);
    return {
      provider: SocialProvider.NAVER,
      providerUserId,
      providerEmail: null,
      emailVerified: null,
      name: null,
    };
  }
}
