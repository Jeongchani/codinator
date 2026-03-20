import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

interface AccessTokenPayload {
  sub: number;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthTokenService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'SECRET_KEY';

  signAccessToken(userId: number): string {
    return jwt.sign({ sub: userId }, this.jwtSecret, {
      expiresIn: '1h',
    });
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
      const payload = jwt.verify(token, this.jwtSecret) as unknown as AccessTokenPayload;

      if (typeof payload.sub !== 'number') {
        throw new UnauthorizedException('유효하지 않은 토큰입니다.');
      }

      return payload.sub;
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
}
