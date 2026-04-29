import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios'; // SocialCodeExchange
import {
  ExchangeKakaoCodeRequest,
  ExchangeNaverCodeRequest,
  LoginResponse,
  LogoutRequest,
  LogoutResponse,
  PasswordResetRequest,
  PasswordResetResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  SocialCodeExchangeResponse,
  SocialCompleteProfileRequest,
  SocialCompleteProfileResponse,
  SocialLoginRequest,
  SocialLoginResponse,
} from '@codinator/contracts';
import {
  Gender,
  PhoneVerificationPurpose,
  PhoneVerificationStatus,
  SanctionType,
  SocialProvider,
  UserStatus,
} from '@prisma/client';
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
import { SocialProviderVerifierFactory } from './social/social-provider-verifier.factory';

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
    private readonly socialVerifierFactory: SocialProviderVerifierFactory,
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

    // P0: status 무관하게 최신 레코드를 먼저 조회해 blockedUntil 우회 방지
    // FAILED+blockedUntil 상태에서 새 row를 만들면 24h 차단이 무력화되므로
    const latestRecord = await this.prisma.phoneVerification.findFirst({
      where: { phoneNumber, purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (latestRecord?.blockedUntil && latestRecord.blockedUntil > now) {
      throw new ForbiddenException(
        `인증 시도 차단 상태입니다. 차단 해제 시각: ${latestRecord.blockedUntil.toISOString()}`,
      );
    }

    // 유효한(PENDING, 미만료) 레코드 조회 — 재전송 정책 적용 대상
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
  async login(
    dto: LoginRequestDto,
    meta?: { userAgent?: string; ipAddress?: string }, // V3-LoginSession: 디바이스 메타 저장용
  ): Promise<LoginResponse> {
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

    // 활성 로그인 제한 제재 확인 (TEMP_SUSPENSION / PERMANENT_BAN)
    await this.assertNoActiveLoginSanction(user.id);

    // rememberMe=true → refresh token 발급 + user_sessions 저장 // RememberMe
    if (dto.rememberMe === true) {
      const { accessToken, refreshToken } = await this.createSession(user.id, user.email, meta);
      return {
        user: { id: user.id, email: user.email, nickname: user.nickname },
        accessToken,
        refreshToken,
      };
    }

    // rememberMe=false 또는 미입력 → access token만 발급, 세션 없음 // RememberMe
    const accessToken = this.authTokenService.signAccessToken(user.id, user.email);
    return {
      user: { id: user.id, email: user.email, nickname: user.nickname },
      accessToken,
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

    // 탈퇴/정지 계정 확인
    if (
      session.user.status === UserStatus.DELETED ||
      session.user.status === UserStatus.SUSPENDED
    ) {
      throw new UnauthorizedException('사용할 수 없는 계정입니다. 고객센터에 문의해 주세요.');
    }

    // 활성 로그인 제한 제재 확인
    await this.assertNoActiveLoginSanction(session.user.id);

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
  // POST /auth/social/login
  // ──────────────────────────────────────────────────────────────────────────
  async socialLogin(dto: SocialLoginRequest): Promise<SocialLoginResponse> {
    const provider = dto.provider as SocialProvider;

    // Provider 토큰 실제 검증 (Google: ID token, Kakao/Naver: access token)
    const verifier = this.socialVerifierFactory.getVerifier(provider);
    const profile = await verifier.verify(dto.providerToken);

    // ── 1. 기존 소셜 계정 조회 ─────────────────────────────────────────────
    const socialAccount = await this.prisma.socialAccount.findUnique({
      where: {
        provider_providerUserId: { provider, providerUserId: profile.providerUserId },
      },
      include: { user: { select: { id: true, status: true } } },
    });

    if (socialAccount) {
      const { status } = socialAccount.user;
      if (status === UserStatus.DELETED) {
        // 탈퇴 계정 — complete-profile 로 보내도 ForbiddenException 으로 막힘: 여기서 미리 알림
        return { isNewUser: false, canProceed: false, reason: 'ACCOUNT_DELETED' };
      }
      if (status === UserStatus.SUSPENDED) {
        return { isNewUser: false, canProceed: false, reason: 'ACCOUNT_SUSPENDED' };
      }
      // ACTIVE: 기존 연결 계정 — complete-profile 바로 호출 가능
      return { isNewUser: false, canProceed: true };
    }

    // ── 2. 소셜 계정 없음: email 없으면 가입/연동 불가 (정책 C) ───────────
    if (!profile.providerEmail) {
      throw new BadRequestException(
        '소셜 제공자가 이메일을 반환하지 않아 가입/연동을 진행할 수 없습니다. ' +
        '소셜 앱 설정에서 이메일 제공에 동의 후 다시 시도해 주세요.',
      );
    }

    const providerEmailLower = profile.providerEmail.toLowerCase();

    // ── 3. emailVerified === true: 기존 회원 자동 연동 후보 판정 (정책 A/D) ─
    if (profile.emailVerified === true) {
      const emailUser = await this.prisma.user.findUnique({
        where: { email: providerEmailLower },
        select: { id: true, status: true },
      });
      if (emailUser) {
        if (emailUser.status === UserStatus.DELETED) {
          return { isNewUser: false, canProceed: false, reason: 'ACCOUNT_DELETED' };
        }
        if (emailUser.status === UserStatus.SUSPENDED) {
          return { isNewUser: false, canProceed: false, reason: 'ACCOUNT_SUSPENDED' };
        }
        // ACTIVE: complete-profile 에서 소셜 계정 자동 연동 후 로그인
        return { isNewUser: false, canProceed: true };
      }
      // 동일 이메일 회원 없음 → 신규 가입 가능
      return { isNewUser: true, canProceed: true };
    }

    // ── 4. emailVerified === null/false (정책 D) ───────────────────────────
    //   Naver: API 미제공(null) / Google·Kakao: false
    //   → auto-link 불가. 하지만 동일 이메일 계정이 있으면 complete-profile 에서도 막힘.
    //   → 미리 확인하여 프론트가 불필요하게 신규가입 화면으로 가지 않도록 알림.
    const emailUser = await this.prisma.user.findUnique({
      where: { email: providerEmailLower },
      select: { id: true, status: true },
    });
    if (emailUser) {
      // 어떤 status 든 auto-link 불가 + 신규 가입도 이메일 중복으로 불가
      return { isNewUser: false, canProceed: false, reason: 'EMAIL_LINK_BLOCKED' };
    }

    // 동일 이메일 계정 없음 + emailVerified 불명확 → 신규 가입 허용
    return { isNewUser: true, canProceed: true };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST /auth/social/complete-profile
  // ──────────────────────────────────────────────────────────────────────────
  async socialCompleteProfile(
    dto: SocialCompleteProfileRequest,
    meta?: { userAgent?: string; ipAddress?: string }, // V3-LoginSession
  ): Promise<SocialCompleteProfileResponse> {
    const provider = dto.provider as SocialProvider;

    // providerToken 재검증 — Provider API 직접 호출로 신뢰성 보장
    const verifier = this.socialVerifierFactory.getVerifier(provider);
    const profile = await verifier.verify(dto.providerToken);

    // 정책 C: provider email 없음 → 가입/연동 금지 (fake email 생성 절대 금지)
    if (!profile.providerEmail) {
      throw new BadRequestException(
        '소셜 제공자가 이메일을 반환하지 않아 가입/연동을 진행할 수 없습니다. ' +
        '소셜 앱 설정에서 이메일 제공에 동의 후 다시 시도해 주세요.',
      );
    }

    const providerEmail = profile.providerEmail.toLowerCase();

    // 기존 소셜 계정 조회 (이미 연결된 경우)
    const socialAccount = await this.prisma.socialAccount.findUnique({
      where: {
        provider_providerUserId: { provider, providerUserId: profile.providerUserId },
      },
      include: { user: { select: { id: true, email: true, nickname: true, status: true } } },
    });

    if (socialAccount) {
      // 연결된 user 가 DELETED → 재가입 차단
      if (socialAccount.user.status === UserStatus.DELETED) {
        throw new ForbiddenException(
          '탈퇴 처리된 계정입니다. 재가입이 불가합니다. 고객센터에 문의해 주세요.',
        );
      }

      if (socialAccount.user.status === UserStatus.SUSPENDED) {
        throw new UnauthorizedException('사용할 수 없는 계정입니다. 고객센터에 문의해 주세요.');
      }

      // ACTIVE: 기존 연결 계정 로그인
      const user = socialAccount.user;
      await this.assertNoActiveLoginSanction(user.id);

      // rememberMe=true → refresh token 발급 + user_sessions 저장 // RememberMe
      if (dto.rememberMe === true) {
        const { accessToken, refreshToken } = await this.createSession(user.id, user.email ?? '', meta);
        return {
          accessToken,
          refreshToken,
          user: { id: user.id, email: user.email, nickname: user.nickname },
          isNewUser: false,
        };
      }

      // rememberMe=false 또는 미입력 → access token만 발급 // RememberMe
      const accessToken = this.authTokenService.signAccessToken(user.id, user.email ?? '');
      return {
        accessToken,
        user: { id: user.id, email: user.email, nickname: user.nickname },
        isNewUser: false,
      };
    }

    // ── 소셜 계정 없음: email 기준 자동 연동 또는 신규 가입 판단 ──────────
    //
    // 정책 A: emailVerified === true 일 때만 auto-link 허용
    // 정책 D: emailVerified null/false → auto-link 금지
    //   - Naver: API 미제공(null) → auto-link 불가
    //   - Google/Kakao: false → auto-link 불가
    const canAutoLink = profile.emailVerified === true;

    const emailUser = await this.prisma.user.findUnique({
      where: { email: providerEmail },
      select: { id: true, email: true, nickname: true, status: true },
    });

    if (emailUser) {
      if (!canAutoLink) {
        // 정책 D: email verified 불명확 → 자동 연동 금지, 명확한 에러 반환
        throw new BadRequestException(
          '이 이메일로 가입된 계정이 이미 있지만, 소셜 이메일 인증 상태를 확인할 수 없어 자동 연동이 불가합니다. ' +
          '이메일/비밀번호로 로그인 후 소셜 계정 연동을 진행해 주세요.',
        );
      }

      // canAutoLink === true: 기존 회원에 소셜 계정 연결
      if (emailUser.status === UserStatus.DELETED) {
        throw new ForbiddenException(
          '탈퇴 처리된 계정의 이메일과 동일합니다. 고객센터에 문의해 주세요.',
        );
      }
      if (emailUser.status === UserStatus.SUSPENDED) {
        throw new UnauthorizedException('사용할 수 없는 계정입니다. 고객센터에 문의해 주세요.');
      }

      // ACTIVE: 소셜 계정 연결 (기존 passwordHash 절대 덮어쓰지 않음) // 정책 A
      await this.assertNoActiveLoginSanction(emailUser.id);

      await this.prisma.socialAccount.create({
        data: {
          userId: emailUser.id,
          provider,
          providerUserId: profile.providerUserId,
          providerEmail,
        },
      });

      // rememberMe 준수 // RememberMe
      if (dto.rememberMe === true) {
        const { accessToken, refreshToken } = await this.createSession(
          emailUser.id,
          emailUser.email,
          meta,
        );
        return {
          accessToken,
          refreshToken,
          user: { id: emailUser.id, email: emailUser.email, nickname: emailUser.nickname },
          isNewUser: false,
        };
      }

      const accessToken = this.authTokenService.signAccessToken(emailUser.id, emailUser.email);
      return {
        accessToken,
        user: { id: emailUser.id, email: emailUser.email, nickname: emailUser.nickname },
        isNewUser: false,
      };
    }

    // ── 신규 회원 가입 (동일 이메일 기존 회원 없음) ───────────────────────
    // 정책 B: password 필수
    const {
      nickname,
      birthDate,
      gender: genderStr,
      phoneNumber: rawPhone,
      phoneVerificationToken,
      password,
    } = dto;

    if (!nickname || !birthDate || !genderStr || !rawPhone || !phoneVerificationToken || !password) {
      throw new BadRequestException(
        '신규 회원 가입 시 nickname, birthDate, gender, phoneNumber, phoneVerificationToken, password 는 필수입니다.',
      );
    }

    if (!isValidPassword(password)) {
      throw new BadRequestException(
        '비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.',
      );
    }

    const phoneNumber = normalizePhoneNumber(rawPhone);
    const gender = this.normalizeGender(genderStr);
    const parsedBirthDate = this.normalizeBirthDate(birthDate);

    // 전화번호 인증 토큰 검증 (purpose=SIGN_UP)
    const phonePayload = this.authTokenService.verifyPhoneVerificationToken(phoneVerificationToken);

    if (phonePayload.purpose !== PhoneVerificationPurpose.SIGN_UP) {
      throw new BadRequestException('소셜 회원가입에 사용할 수 없는 전화번호 인증 토큰입니다.');
    }

    if (phonePayload.phoneNumber !== phoneNumber) {
      throw new BadRequestException('인증된 전화번호와 입력한 전화번호가 일치하지 않습니다.');
    }

    const phoneVerification = await this.prisma.phoneVerification.findUnique({
      where: { id: phonePayload.phoneVerificationId },
    });

    if (
      !phoneVerification ||
      phoneVerification.status !== PhoneVerificationStatus.VERIFIED ||
      phoneVerification.phoneNumber !== phoneNumber ||
      phoneVerification.purpose !== PhoneVerificationPurpose.SIGN_UP
    ) {
      throw new BadRequestException('유효하지 않은 전화번호 인증입니다. 다시 인증해 주세요.');
    }

    const trimmedNickname = nickname.trim();

    if (!trimmedNickname) {
      throw new BadRequestException('닉네임은 빈 값일 수 없습니다.');
    }

    if (trimmedNickname.length > 30) {
      throw new BadRequestException('닉네임은 최대 30자입니다.');
    }

    const [existingNickname, existingPhone] = await Promise.all([
      this.prisma.user.findUnique({ where: { nickname: trimmedNickname }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { phoneNumber }, select: { id: true } }),
    ]);

    if (existingNickname) throw new ConflictException('이미 사용 중인 닉네임입니다.');
    if (existingPhone) throw new ConflictException('이미 가입된 전화번호입니다.');

    // 정책 B: 신규 소셜가입도 passwordHash 저장
    const passwordHash = await bcrypt.hash(password, 10);

    // 트랜잭션: 유저 생성 + 소셜 계정 연결 + 전화번호 인증 USED 처리
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: providerEmail, // provider 제공 이메일 사용 (fake email 금지)
          nickname: trimmedNickname,
          passwordHash, // 신규 소셜가입 사용자도 앱 전용 비밀번호 저장
          birthDate: parsedBirthDate,
          gender,
          phoneNumber,
        },
      });

      await tx.socialAccount.create({
        data: {
          userId: created.id,
          provider,
          providerUserId: profile.providerUserId,
          providerEmail,
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

    // rememberMe=true → refresh token 발급 + user_sessions 저장 // RememberMe
    if (dto.rememberMe === true) {
      const { accessToken, refreshToken } = await this.createSession(user.id, user.email, meta);
      return {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, nickname: user.nickname },
        isNewUser: true,
      };
    }

    // rememberMe=false 또는 미입력 → access token만 발급 // RememberMe
    const accessToken = this.authTokenService.signAccessToken(user.id, user.email);
    return {
      accessToken,
      user: { id: user.id, email: user.email, nickname: user.nickname },
      isNewUser: true,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PATCH /auth/password-reset
  // ──────────────────────────────────────────────────────────────────────────
  async passwordReset(dto: PasswordResetRequest): Promise<PasswordResetResponse> {
    const phoneNumber = normalizePhoneNumber(dto.phoneNumber);

    // 전화번호 인증 토큰 검증 (purpose=PASSWORD_RESET)
    const phonePayload = this.authTokenService.verifyPhoneVerificationToken(
      dto.phoneVerificationToken,
    );

    if (phonePayload.purpose !== PhoneVerificationPurpose.PASSWORD_RESET) {
      throw new BadRequestException('비밀번호 재설정에 사용할 수 없는 전화번호 인증 토큰입니다.');
    }

    if (phonePayload.phoneNumber !== phoneNumber) {
      throw new BadRequestException('인증된 전화번호와 입력한 전화번호가 일치하지 않습니다.');
    }

    const phoneVerification = await this.prisma.phoneVerification.findUnique({
      where: { id: phonePayload.phoneVerificationId },
    });

    if (
      !phoneVerification ||
      phoneVerification.status !== PhoneVerificationStatus.VERIFIED ||
      phoneVerification.phoneNumber !== phoneNumber ||
      phoneVerification.purpose !== PhoneVerificationPurpose.PASSWORD_RESET
    ) {
      throw new BadRequestException('유효하지 않은 전화번호 인증입니다. 다시 인증해 주세요.');
    }

    if (!isValidPassword(dto.newPassword)) {
      throw new BadRequestException(
        '비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { phoneNumber },
      select: { id: true, status: true, passwordHash: true },
    });

    if (!user || user.status === UserStatus.DELETED) {
      throw new NotFoundException('해당 전화번호로 가입된 계정을 찾을 수 없습니다.');
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        '소셜 로그인 전용 계정은 비밀번호 재설정을 사용할 수 없습니다.',
      );
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      }),
      this.prisma.phoneVerification.update({
        where: { id: phoneVerification.id },
        data: { status: PhoneVerificationStatus.USED, usedAt: new Date(), userId: user.id },
      }),
    ]);

    return { success: true, message: '비밀번호가 재설정되었습니다.' };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST /auth/social/kakao/exchange-code // SocialCodeExchange
  // ──────────────────────────────────────────────────────────────────────────
  async exchangeKakaoCode(
    dto: ExchangeKakaoCodeRequest,
  ): Promise<SocialCodeExchangeResponse> {
    // 1) 인가코드 → access token 교환 // SocialCodeExchange
    const providerToken = await this.fetchKakaoAccessToken(dto.code, dto.redirectUri);

    // 2) 기존 socialLogin 로직 재사용 (계정 조회 + isNewUser/canProceed 판정) // SocialCodeExchange
    const { isNewUser, canProceed, reason } = await this.socialLogin({
      provider: SocialProvider.KAKAO,
      providerToken,
    });

    return { providerToken, isNewUser, canProceed, reason };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST /auth/social/naver/exchange-code // SocialCodeExchange
  // ──────────────────────────────────────────────────────────────────────────
  async exchangeNaverCode(
    dto: ExchangeNaverCodeRequest,
  ): Promise<SocialCodeExchangeResponse> {
    // 1) 인가코드 → access token 교환 // SocialCodeExchange
    const providerToken = await this.fetchNaverAccessToken(dto.code, dto.state, dto.redirectUri);

    // 2) 기존 socialLogin 로직 재사용 (계정 조회 + isNewUser/canProceed 판정) // SocialCodeExchange
    const { isNewUser, canProceed, reason } = await this.socialLogin({
      provider: SocialProvider.NAVER,
      providerToken,
    });

    return { providerToken, isNewUser, canProceed, reason };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  /** 활성 로그인 제한 제재(TEMP_SUSPENSION / PERMANENT_BAN) 존재 시 예외 */
  private async assertNoActiveLoginSanction(userId: number): Promise<void> {
    const now = new Date();
    const sanction = await this.prisma.userSanction.findFirst({
      where: {
        sanctionedUserId: userId,
        type: { in: [SanctionType.TEMP_SUSPENSION, SanctionType.PERMANENT_BAN] },
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      select: { type: true, endsAt: true },
    });

    if (sanction) {
      const until = sanction.endsAt ? ` (${sanction.endsAt.toISOString()} 까지)` : '';
      throw new ForbiddenException(`로그인이 제한된 계정입니다${until}. 고객센터에 문의해 주세요.`);
    }
  }

  /** 세션(Refresh Token) 생성 후 Access/Refresh Token 반환 // V3-LoginSession */
  private async createSession(
    userId: number,
    email: string,
    meta?: { userAgent?: string; ipAddress?: string }, // V3-LoginSession: userAgent / ipAddress 저장
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.authTokenService.signAccessToken(userId, email);
    const refreshToken = this.authTokenService.signRefreshToken(userId, email);
    const refreshTokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // refresh 7일

    await this.prisma.userSession.create({
      data: {
        userId,
        refreshTokenHash,
        expiresAt,
        userAgent: meta?.userAgent ?? null,   // V3-LoginSession
        ipAddress: meta?.ipAddress ?? null,   // V3-LoginSession
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Kakao 인가코드 → access token 교환.
   * 항상 실제 Kakao 인증 서버로 교환 요청 (mock/stub 없음).
   */ // SocialCodeExchange
  private async fetchKakaoAccessToken(code: string, redirectUri: string): Promise<string> {
    const clientId = process.env.KAKAO_REST_API_KEY;
    if (!clientId) {
      throw new BadGatewayException('KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.');
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code,
    });
    const clientSecret = process.env.KAKAO_CLIENT_SECRET;
    if (clientSecret) params.append('client_secret', clientSecret);

    interface KakaoTokenResponse {
      access_token?: string;
      error?: string;
      error_description?: string;
    }

    try {
      const { data } = await axios.post<KakaoTokenResponse>(
        'https://kauth.kakao.com/oauth/token',
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10_000 },
      );
      if (!data.access_token) {
        throw new UnauthorizedException(data.error_description ?? '유효하지 않은 Kakao 인가코드입니다.');
      }
      return data.access_token;
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException) throw err;
      if (axios.isAxiosError(err)) {
        const errData = err.response?.data as KakaoTokenResponse | undefined;
        if (errData?.error) {
          throw new UnauthorizedException(errData.error_description ?? `Kakao 인가코드 교환 실패: ${errData.error}`);
        }
      }
      throw new BadGatewayException('Kakao 인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  /**
   * Naver 인가코드 → access token 교환.
   * 항상 실제 Naver 인증 서버로 교환 요청 (mock/stub 없음).
   */ // SocialCodeExchange
  private async fetchNaverAccessToken(
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<string> {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new BadGatewayException('NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다.');
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
      state,
    });

    interface NaverTokenResponse {
      access_token?: string;
      error?: string;
      error_description?: string;
    }

    try {
      const { data } = await axios.post<NaverTokenResponse>(
        'https://nid.naver.com/oauth2.0/token',
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10_000 },
      );
      if (!data.access_token) {
        throw new UnauthorizedException(data.error_description ?? '유효하지 않은 Naver 인가코드입니다.');
      }
      return data.access_token;
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException) throw err;
      if (axios.isAxiosError(err)) {
        const errData = err.response?.data as NaverTokenResponse | undefined;
        if (errData?.error) {
          throw new UnauthorizedException(errData.error_description ?? `Naver 인가코드 교환 실패: ${errData.error}`);
        }
      }
      throw new BadGatewayException('Naver 인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    }
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
