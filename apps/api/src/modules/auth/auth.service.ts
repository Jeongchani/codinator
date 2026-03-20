import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SignupRequestDto } from './dto/signup-request.dto';
import { SignupResponseDto } from './dto/signup-response.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { AuthTokenService } from './auth-token.service';
import * as bcrypt from 'bcryptjs';
import {
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  LogoutRequest,
  LogoutResponse,
} from '@codinator/contracts';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  async signup(dto: SignupRequestDto): Promise<SignupResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new BadRequestException('이미 가입된 이메일입니다.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: hashedPassword,
      },
    });

    return { userId: user.id, email: user.email };
  }

  async login(dto: LoginRequestDto): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const accessToken = this.authTokenService.signAccessToken(user.id, user.email);
    const refreshToken = this.authTokenService.signRefreshToken(user.id, user.email);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: this.hashToken(refreshToken),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
      },
      accessToken,
      refreshToken,
    };
  }

  async refresh(dto: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    const payload = this.authTokenService.verifyRefreshToken(dto.refreshToken);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('다시 로그인해 주세요.');
    }

    const incomingRefreshTokenHash = this.hashToken(dto.refreshToken);

    if (user.refreshTokenHash !== incomingRefreshTokenHash) {
      throw new UnauthorizedException('유효하지 않은 리프레시 토큰입니다.');
    }

    const accessToken = this.authTokenService.signAccessToken(user.id, user.email);

    return { accessToken };
  }

  async logout(dto: LogoutRequest): Promise<LogoutResponse> {
    const payload = this.authTokenService.verifyRefreshToken(dto.refreshToken);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, refreshTokenHash: true },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('이미 로그아웃되었거나 유효하지 않은 토큰입니다.');
    }

    const incomingRefreshTokenHash = this.hashToken(dto.refreshToken);

    if (user.refreshTokenHash !== incomingRefreshTokenHash) {
      throw new UnauthorizedException('유효하지 않은 리프레시 토큰입니다.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: null,
      },
    });

    return {
      success: true,
      message: '로그아웃 완료',
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
