import { BadRequestException, Injectable } from '@nestjs/common';
import { SocialProvider } from '@prisma/client';
import type { SocialProviderVerifier } from './social-provider-verifier.interface';
import { GoogleSocialVerifier } from './providers/google-social-verifier';
import { KakaoSocialVerifier } from './providers/kakao-social-verifier';
import { NaverSocialVerifier } from './providers/naver-social-verifier';

/**
 * provider 문자열을 받아 적절한 SocialProviderVerifier 를 반환하는 팩토리.
 * AuthService 는 이 팩토리에만 의존하며 개별 verifier 구현에 직접 의존하지 않는다.
 */
@Injectable()
export class SocialProviderVerifierFactory {
  constructor(
    private readonly google: GoogleSocialVerifier,
    private readonly kakao: KakaoSocialVerifier,
    private readonly naver: NaverSocialVerifier,
  ) {}

  getVerifier(provider: SocialProvider | string): SocialProviderVerifier {
    switch (provider) {
      case SocialProvider.GOOGLE:
        return this.google;
      case SocialProvider.KAKAO:
        return this.kakao;
      case SocialProvider.NAVER:
        return this.naver;
      default:
        throw new BadRequestException(`지원하지 않는 소셜 provider 입니다: ${provider}`);
    }
  }
}
