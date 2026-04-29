import { BadGatewayException, Injectable, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
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
 * - emailVerified: Naver API 가 제공하지 않으므로 null 처리
 *   → emailVerified=null 이므로 기존 회원 자동 연동(auto-link)은 불가
 *   → 신규 가입은 허용하되, 동일 이메일 기존 회원이 있으면 연동 불가 에러 반환
 * - mock/stub 전략 완전 제거 — real provider verification 만 허용
 */
@Injectable()
export class NaverSocialVerifier implements SocialProviderVerifier {
  async verify(providerToken: string): Promise<SocialUserProfile> {
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
      emailVerified: null, // Naver API 미제공 — auto-link 불가
      name: profile.name ?? null,
      nickname: profile.nickname ?? null,
      profileImageUrl: profile.profile_image ?? null,
    };
  }
}
