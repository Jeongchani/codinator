import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';

type AccessTokenPayload = JwtPayload & {
  sub: number;
  email: string;
  type: 'access';
};

type RefreshTokenPayload = JwtPayload & {
  sub: number;
  email: string;
  type: 'refresh';
  jti?: string;
};

export type PhoneVerificationTokenPayload = JwtPayload & {
  phoneVerificationId: number;
  phoneNumber: string;
  purpose: string;
  type: 'phone_verification';
};


@Injectable()
export class AuthTokenService {
  private readonly accessTokenSecret =
    process.env.ACCESS_TOKEN_SECRET || 'SECRET_KEY';

  private readonly refreshTokenSecret =
    process.env.REFRESH_TOKEN_SECRET || 'REFRESH_SECRET_KEY';

  private readonly phoneVerificationTokenSecret =
    process.env.PHONE_VERIFICATION_TOKEN_SECRET || 'PHONE_VERIFY_SECRET';

  signAccessToken(userId: number, email: string): string {
    return jwt.sign(
      { sub: userId, email, type: 'access' },
      this.accessTokenSecret,
      {
        expiresIn: '15m',
      },
    );
  }

  signRefreshToken(userId: number, email: string): string {
    return jwt.sign(
      { sub: userId, email, type: 'refresh', jti: randomUUID() },
      this.refreshTokenSecret,
      {
        expiresIn: '7d',
      },
    );
  }

  signPhoneVerificationToken(
    phoneVerificationId: number,
    phoneNumber: string,
    purpose: string,
  ): string {
    return jwt.sign(
      { phoneVerificationId, phoneNumber, purpose, type: 'phone_verification' },
      this.phoneVerificationTokenSecret,
      { expiresIn: '10m' },
    );
  }

  verifyPhoneVerificationToken(token: string): PhoneVerificationTokenPayload {
    try {
      const decoded = jwt.verify(token, this.phoneVerificationTokenSecret);

      if (!this.isPhoneVerificationTokenPayload(decoded)) {
        throw new UnauthorizedException('유효하지 않은 전화번호 인증 토큰입니다.');
      }

      return decoded;
    } catch {
      throw new UnauthorizedException('유효하지 않거나 만료된 전화번호 인증 토큰입니다.');
    }
  }

  verifyRefreshToken(refreshToken: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(refreshToken, this.refreshTokenSecret);

      if (!this.isRefreshTokenPayload(decoded)) {
        throw new UnauthorizedException('유효하지 않은 리프레시 토큰입니다.');
      }

      return decoded;
    } catch {
      throw new UnauthorizedException(
        '유효하지 않거나 만료된 리프레시 토큰입니다.',
      );
    }
  }

  extractUserIdFromAuthorizationHeader(
    authorization?: string,
    options: { required?: boolean } = {},
  ): number | null {
    const token = this.extractBearerToken(authorization);

    if (!token) {
      if (options.required) {
        throw new UnauthorizedException('로그인이 필요합니다.');
      }

      return null;
    }

    try {
      const decoded = jwt.verify(token, this.accessTokenSecret);

      if (!this.isAccessTokenPayload(decoded)) {
        throw new UnauthorizedException('유효하지 않은 토큰입니다.');
      }

      return decoded.sub;
    } catch {
      throw new UnauthorizedException('유효하지 않거나 만료된 토큰입니다.');
    }
  }

  private extractBearerToken(authorization?: string): string | null {
    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }

  private isAccessTokenPayload(
    value: string | JwtPayload,
  ): value is AccessTokenPayload {
    return (
      typeof value !== 'string' &&
      typeof value.sub === 'number' &&
      typeof value.email === 'string' &&
      value.type === 'access'
    );
  }

  private isRefreshTokenPayload(
    value: string | JwtPayload,
  ): value is RefreshTokenPayload {
    return (
      typeof value !== 'string' &&
      typeof value.sub === 'number' &&
      typeof value.email === 'string' &&
      value.type === 'refresh'
    );
  }

  private isPhoneVerificationTokenPayload(
    value: string | JwtPayload,
  ): value is PhoneVerificationTokenPayload {
    return (
      typeof value !== 'string' &&
      typeof (value as PhoneVerificationTokenPayload).phoneVerificationId === 'number' &&
      typeof (value as PhoneVerificationTokenPayload).phoneNumber === 'string' &&
      typeof (value as PhoneVerificationTokenPayload).purpose === 'string' &&
      value.type === 'phone_verification'
    );
  }
}
