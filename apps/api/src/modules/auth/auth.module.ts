import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthTokenService } from './auth-token.service';
import { GoogleSocialVerifier } from './social/providers/google-social-verifier';
import { KakaoSocialVerifier } from './social/providers/kakao-social-verifier';
import { NaverSocialVerifier } from './social/providers/naver-social-verifier';
import { SocialProviderVerifierFactory } from './social/social-provider-verifier.factory';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokenService,
    GoogleSocialVerifier,
    KakaoSocialVerifier,
    NaverSocialVerifier,
    SocialProviderVerifierFactory,
  ],
  exports: [AuthTokenService],
})
export class AuthModule {}
