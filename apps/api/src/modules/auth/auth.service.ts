import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  LoginResponse,
  LogoutRequest,
  LogoutResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
} from '@codinator/contracts';
import { Gender } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthTokenService } from './auth-token.service';
import { LoginRequestDto } from './dto/login-request.dto';
import { SignupRequestDto } from './dto/signup-request.dto';
import { SignupResponseDto } from './dto/signup-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  async signup(dto: SignupRequestDto): Promise<SignupResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const nickname = dto.nickname.trim();
    const gender = this.normalizeGender(dto.gender);
    const birthDate = this.normalizeBirthDate(dto.birthDate);
    const phoneNumber = this.normalizePhoneNumber(dto.phoneNumber);

    const [existingEmailUser, existingNicknameUser, existingPhoneUser] = await Promise.all([
      this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      }),
      this.prisma.user.findUnique({
        where: { nickname },
        select: { id: true },
      }),
      this.prisma.user.findUnique({
        where: { phoneNumber },
        select: { id: true },
      }),
    ]);

    if (existingEmailUser) {
      throw new BadRequestException('이미 가입된 이메일입니다.');
    }

    if (existingNicknameUser) {
      throw new BadRequestException('이미 사용 중인 닉네임입니다.');
    }

    if (existingPhoneUser) {
      throw new BadRequestException('이미 가입된 전화번호입니다.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        nickname,
        passwordHash: hashedPassword,
        birthDate,
        gender,
        phoneNumber,
      },
    });

    return {
      userId: user.id,
      email: user.email,
      nickname: user.nickname,
      birthDate: user.birthDate.toISOString().slice(0, 10),
      gender: user.gender,
      phoneNumber: user.phoneNumber,
    };
  }

  async login(dto: LoginRequestDto): Promise<LoginResponse> {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
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
    const refreshTokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
      },
      accessToken,
      refreshToken,
    };
  }

  async refresh(dto: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    const payload = this.authTokenService.verifyRefreshToken(dto.refreshToken);
    const incomingRefreshTokenHash = this.hashToken(dto.refreshToken);

    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: incomingRefreshTokenHash },
      include: {
        user: true,
      },
    });

    if (
      !session ||
      session.user.id !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('다시 로그인해 주세요.');
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });

    const accessToken = this.authTokenService.signAccessToken(session.user.id, session.user.email);

    return { accessToken };
  }

  async logout(dto: LogoutRequest): Promise<LogoutResponse> {
    const payload = this.authTokenService.verifyRefreshToken(dto.refreshToken);
    const incomingRefreshTokenHash = this.hashToken(dto.refreshToken);

    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: incomingRefreshTokenHash },
      include: {
        user: {
          select: { id: true },
        },
      },
    });

    if (
      !session ||
      session.user.id !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('이미 로그아웃되었거나 유효하지 않은 토큰입니다.');
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
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

  private normalizePhoneNumber(phoneNumber: string): string {
    const normalized = phoneNumber.replace(/[^0-9]/g, '');

    if (!normalized) {
      throw new BadRequestException('전화번호는 필수값입니다.');
    }

    if (normalized.length < 9 || normalized.length > 15) {
      throw new BadRequestException('전화번호 형식이 올바르지 않습니다.');
    }

    return normalized;
  }

  private normalizeBirthDate(birthDate: string): Date {
    const value = new Date(`${birthDate}T00:00:00.000Z`);

    if (Number.isNaN(value.getTime())) {
      throw new BadRequestException('birthDate는 YYYY-MM-DD 형식이어야 합니다.');
    }

    return value;
  }

  private normalizeGender(gender: string): Gender {
    if (gender !== Gender.MALE && gender !== Gender.FEMALE) {
      throw new BadRequestException('gender는 MALE 또는 FEMALE이어야 합니다.');
    }

    return gender;
  }
}