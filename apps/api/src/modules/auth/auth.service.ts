import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  LoginResponse,
  LogoutRequest,
  LogoutResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
} from '@codinator/contracts';
import { Gender, PhoneVerificationPurpose, PhoneVerificationStatus, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { isValidPassword } from '../../common/helpers/password.helper';
import { normalizePhoneNumber } from '../../common/helpers/phone.helper';
import { AuthTokenService } from './auth-token.service';
import { LoginRequestDto } from './dto/login-request.dto';
import { SendPhoneVerificationDto } from './dto/send-phone-verification.dto';
import { SignupRequestDto } from './dto/signup-request.dto';
import { SignupResponseDto } from './dto/signup-response.dto';
import { VerifyPhoneCodeDto } from './dto/verify-phone-code.dto';

/** 인증번호 유효 시간 (분) */
const CODE_TTL_MINUTES = 5;
/** 재전송 허용 횟수 (최초 발송 제외) */
const MAX_RESEND_COUNT = 3;
/** 실패 누적 횟수: 이 횟수 이상이면 1일 차단 */
const MAX_FAILED_COUNT = 10;
/** 차단 기간 (ms) */
const BLOCK_DURATION_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // POST /auth/signup/check
  // ──────────────────────────────────────────────────────────────────────────
  async checkSignupAvailability(
    dto: { type: 'EMAIL' | 'NICKNAME' | 'PASSWORD'; value: string },
  ): Promise<{ available: boolean; message: string }> {
    const { type } = dto;
    const value = dto.value?.trim();

    if (!value) {
      throw new BadRequestException('확인할 값을 입력해 주세요.');
    }

    if (type === 'EMAIL') {
      const email = value.toLowerCase();
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser) {
        return { available: false, message: '이미 가입된 이메일입니다.' };
      }
      return { available: true, message: '사용 가능한 이메일입니다.' };
    }

    if (type === 'NICKNAME') {
      const existingUser = await this.prisma.user.findUnique({
        where: { nickname: value },
        select: { id: true },
      });

      if (existingUser) {
        return { available: false, message: '이미 사용 중인 닉네임입니다.' };
      }
      return { available: true, message: '사용 가능한 닉네임입니다.' };
    }

    if (type === 'PASSWORD') {
      if (!isValidPassword(value)) {
        return {
          available: false,
          message: '비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.',
        };
      }
      return { available: true, message: '사용 가능한 비밀번호입니다.' };
    }

    throw new BadRequestException('지원하지 않는 확인 타입입니다.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST /auth/phone/send
  // ──────────────────────────────────────────────────────────────────────────
  async sendPhoneVerification(dto: SendPhoneVerificationDto): Promise<{
    message: string;
    expiresAt: string;
    debugCode?: string;
  }> {
    const phoneNumber = normalizePhoneNumber(dto.phoneNumber);
    const purpose = dto.purpose as PhoneVerificationPurpose;
    const now = new Date();

    // 현재 유효한(PENDING) 레코드 조회
    const existing = await this.prisma.phoneVerification.findFirst({
      where: {
        phoneNumber,
        purpose,
        status: PhoneVerificationStatus.PENDING,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      // 차단 여부 확인
      if (existing.blockedUntil && existing.blockedUntil > now) {
        const unblockAt = existing.blockedUntil.toISOString();
        throw new ForbiddenException(`인증 시도 차단 상태입니다. 차단 해제 시각: ${unblockAt}`);
      }

      // 재전송 한도 확인
      if (existing.resendCount >= MAX_RESEND_COUNT) {
        throw new HttpException(
          `재전송 횟수(${MAX_RESEND_COUNT}회)를 초과했습니다. 잠시 후 다시 시도해 주세요.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // 6자리 인증 코드 생성 및 해시
    const code = String(randomInt(100000, 999999));
    const codeHash = createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000);

    if (existing) {
      // 기존 PENDING 레코드 갱신 (재전송)
      await this.prisma.phoneVerification.update({
        where: { id: existing.id },
        data: {
          verificationCodeHash: codeHash,
          expiresAt,
          resendCount: existing.resendCount + 1,
        },
      });
    } else {
      // 신규 레코드 생성
      await this.prisma.phoneVerification.create({
        data: {
          phoneNumber,
          purpose,
          verificationCodeHash: codeHash,
          status: PhoneVerificationStatus.PENDING,
          expiresAt,
          resendCount: 0,
          failedCount: 0,
        },
      });
    }

    // 운영 환경에서는 실제 SMS 발송 (현재는 stub)
    if (process.env.NODE_ENV === 'production') {
      // TODO: SMS 발송 서비스 연동
    }

    const result: { message: string; expiresAt: string; debugCode?: string } = {
      message: '인증번호가 발송되었습니다.',
      expiresAt: expiresAt.toISOString(),
    };

    // 비운영 환경에서만 debugCode 노출
    if (process.env.NODE_ENV !== 'production') {
      result.debugCode = code;
    }

    return result;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST /auth/phone/verify
  // ──────────────────────────────────────────────────────────────────────────
  async verifyPhoneCode(dto: VerifyPhoneCodeDto): Promise<{
    phoneVerificationToken: string;
    expiresAt: string;
  }> {
    const phoneNumber = normalizePhoneNumber(dto.phoneNumber);
    const purpose = dto.purpose as PhoneVerificationPurpose;
    const now = new Date();

    // PENDING 레코드 조회 (만료 여부 무관하게 조회하여 상태 전이 처리)
    const record = await this.prisma.phoneVerification.findFirst({
      where: {
        phoneNumber,
        purpose,
        status: PhoneVerificationStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException('인증번호를 먼저 요청해 주세요.');
    }

    // 차단 여부 확인
    if (record.blockedUntil && record.blockedUntil > now) {
      const unblockAt = record.blockedUntil.toISOString();
      throw new ForbiddenException(`인증 시도 차단 상태입니다. 차단 해제 시각: ${unblockAt}`);
    }

    // 만료 확인
    if (record.expiresAt <= now) {
      await this.prisma.phoneVerification.update({
        where: { id: record.id },
        data: { status: PhoneVerificationStatus.EXPIRED },
      });
      throw new BadRequestException('인증번호가 만료되었습니다. 다시 요청해 주세요.');
    }

    // 코드 검증
    const inputHash = createHash('sha256').update(dto.code).digest('hex');
    if (inputHash !== record.verificationCodeHash) {
      const newFailedCount = record.failedCount + 1;

      if (newFailedCount >= MAX_FAILED_COUNT) {
        // 10회 실패 → 1일 차단
        await this.prisma.phoneVerification.update({
          where: { id: record.id },
          data: {
            failedCount: newFailedCount,
            status: PhoneVerificationStatus.FAILED,
            blockedUntil: new Date(now.getTime() + BLOCK_DURATION_MS),
          },
        });
        throw new ForbiddenException('인증 실패 횟수를 초과했습니다. 24시간 후에 다시 시도해 주세요.');
      }

      await this.prisma.phoneVerification.update({
        where: { id: record.id },
        data: { failedCount: newFailedCount },
      });

      const remaining = MAX_FAILED_COUNT - newFailedCount;
      throw new BadRequestException(`인증번호가 올바르지 않습니다. (${remaining}회 남음)`);
    }

    // 인증 성공 → VERIFIED 상태로 전이
    await this.prisma.phoneVerification.update({
      where: { id: record.id },
      data: {
        status: PhoneVerificationStatus.VERIFIED,
        verifiedAt: now,
      },
    });

    // phoneVerificationToken 발급 (유효 10분)
    const phoneVerificationToken = this.authTokenService.signPhoneVerificationToken(
      record.id,
      phoneNumber,
      purpose,
    );

    // 토큰 만료 시각 (now + 10분)
    const tokenExpiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

    return { phoneVerificationToken, expiresAt: tokenExpiresAt };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST /auth/signup
  // ──────────────────────────────────────────────────────────────────────────
  async signup(dto: SignupRequestDto): Promise<SignupResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const nickname = dto.nickname.trim();
    const gender = this.normalizeGender(dto.gender);
    const birthDate = this.normalizeBirthDate(dto.birthDate);
    const phoneNumber = normalizePhoneNumber(dto.phoneNumber);

    if (!isValidPassword(dto.password)) {
      throw new BadRequestException('비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.');
    }

    // phoneVerificationToken 검증
    const tokenPayload = this.authTokenService.verifyPhoneVerificationToken(
      dto.phoneVerificationToken,
    );

    if (tokenPayload.purpose !== 'SIGN_UP') {
      throw new BadRequestException('회원가입에 사용할 수 없는 전화번호 인증 토큰입니다.');
    }

    if (tokenPayload.phoneNumber !== phoneNumber) {
      throw new BadRequestException('인증된 전화번호와 입력한 전화번호가 일치하지 않습니다.');
    }

    // PhoneVerification 레코드 확인 (VERIFIED 상태여야 함)
    const phoneVerification = await this.prisma.phoneVerification.findUnique({
      where: { id: tokenPayload.phoneVerificationId },
    });

    if (
      !phoneVerification ||
      phoneVerification.status !== PhoneVerificationStatus.VERIFIED ||
      phoneVerification.phoneNumber !== phoneNumber ||
      phoneVerification.purpose !== PhoneVerificationPurpose.SIGN_UP
    ) {
      throw new BadRequestException('유효하지 않은 전화번호 인증입니다. 다시 인증해 주세요.');
    }

    const [existingEmailUser, existingNicknameUser, existingPhoneUser] = await Promise.all([
      this.prisma.user.findUnique({ where: { email }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { nickname }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { phoneNumber }, select: { id: true } }),
    ]);

    if (existingEmailUser) throw new BadRequestException('이미 가입된 이메일입니다.');
    if (existingNicknameUser) throw new BadRequestException('이미 사용 중인 닉네임입니다.');
    if (existingPhoneUser) throw new BadRequestException('이미 가입된 전화번호입니다.');

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 트랜잭션: 사용자 생성 + 전화번호 인증 USED 처리
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          nickname,
          passwordHash: hashedPassword,
          birthDate,
          gender,
          phoneNumber,
        },
      });

      await tx.phoneVerification.update({
        where: { id: phoneVerification.id },
        data: {
          status: PhoneVerificationStatus.USED,
          usedAt: new Date(),
          userId: created.id,
        },
      });

      return created;
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

  // ──────────────────────────────────────────────────────────────────────────
  // POST /auth/login
  // ──────────────────────────────────────────────────────────────────────────
  async login(dto: LoginRequestDto): Promise<LoginResponse> {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    if (user.status === UserStatus.DELETED || user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('사용할 수 없는 계정입니다. 고객센터에 문의해 주세요.');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('비밀번호 로그인 계정이 아닙니다.');
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

  // ──────────────────────────────────────────────────────────────────────────
  // POST /auth/refresh
  // ──────────────────────────────────────────────────────────────────────────
  async refresh(dto: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    const payload = this.authTokenService.verifyRefreshToken(dto.refreshToken);
    const incomingRefreshTokenHash = this.hashToken(dto.refreshToken);

    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: incomingRefreshTokenHash },
      include: { user: true },
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

  // ──────────────────────────────────────────────────────────────────────────
  // POST /auth/logout
  // ──────────────────────────────────────────────────────────────────────────
  async logout(dto: LogoutRequest): Promise<LogoutResponse> {
    const payload = this.authTokenService.verifyRefreshToken(dto.refreshToken);
    const incomingRefreshTokenHash = this.hashToken(dto.refreshToken);

    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: incomingRefreshTokenHash },
      include: { user: { select: { id: true } } },
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
      data: { revokedAt: new Date() },
    });

    return { success: true, message: '로그아웃 완료' };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
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
