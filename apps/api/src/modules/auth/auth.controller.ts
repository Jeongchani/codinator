import { Body, Controller, HttpCode, HttpStatus, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ExchangeKakaoCodeDto } from './dto/exchange-kakao-code.dto'; // SocialCodeExchange
import { ExchangeNaverCodeDto } from './dto/exchange-naver-code.dto'; // SocialCodeExchange
import { LoginResponseDto } from './dto/login-response.dto';
import { SendPhoneVerificationDto } from './dto/send-phone-verification.dto';
import { SignupRequestDto } from './dto/signup-request.dto';
import { SignupResponseDto } from './dto/signup-response.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { VerifyPhoneCodeDto } from './dto/verify-phone-code.dto';
import {
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

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── POST /auth/signup/check ───────────────────────────────────────────────

  @Post('signup/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '회원가입 입력값 사용 가능 여부 확인 (이메일/닉네임/비밀번호)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['type', 'value'],
      properties: {
        type: {
          type: 'string',
          enum: ['EMAIL', 'NICKNAME', 'PASSWORD'],
          example: 'EMAIL',
        },
        value: {
          type: 'string',
          example: 'test@example.com',
        },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        available: { type: 'boolean', example: true },
        message: { type: 'string', example: '사용 가능한 이메일입니다.' },
      },
    },
  })
  async checkSignupAvailability(
    @Body() dto: { type: 'EMAIL' | 'NICKNAME' | 'PASSWORD'; value: string },
  ): Promise<{ available: boolean; message: string }> {
    return this.authService.checkSignupAvailability(dto);
  }

  // ── POST /auth/phone/send ─────────────────────────────────────────────────

  @Post('phone/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '전화번호 인증번호 발송' })
  @ApiBody({ type: SendPhoneVerificationDto })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: '인증번호가 발송되었습니다.' },
        expiresAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:05:00.000Z' },
        debugCode: {
          type: 'string',
          example: '123456',
          description: '비운영 환경에서만 노출되는 인증번호 (production 미포함)',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: '전화번호 형식 오류' })
  @ApiForbiddenResponse({ description: '인증 시도 차단 상태 (10회 실패)' })
  @ApiTooManyRequestsResponse({ description: '재전송 횟수 초과 (최대 3회)' })
  async sendPhoneVerification(
    @Body() dto: SendPhoneVerificationDto,
  ): Promise<{ message: string; expiresAt: string; debugCode?: string }> {
    return this.authService.sendPhoneVerification(dto);
  }

  // ── POST /auth/phone/verify ───────────────────────────────────────────────

  @Post('phone/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '전화번호 인증번호 확인 → phoneVerificationToken 발급' })
  @ApiBody({ type: VerifyPhoneCodeDto })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        phoneVerificationToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          description: '회원가입/전화번호 변경 등에 사용할 인증 토큰 (10분 유효)',
        },
        expiresAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:10:00.000Z' },
      },
    },
  })
  @ApiBadRequestResponse({ description: '인증번호 불일치 또는 만료' })
  @ApiForbiddenResponse({ description: '인증 시도 차단 상태' })
  async verifyPhoneCode(
    @Body() dto: VerifyPhoneCodeDto,
  ): Promise<{ phoneVerificationToken: string; expiresAt: string }> {
    return this.authService.verifyPhoneCode(dto);
  }

  // ── POST /auth/signup ─────────────────────────────────────────────────────

  @Post('signup')
  @ApiOperation({ summary: '회원가입 (phoneVerificationToken 필수)' })
  @ApiBody({ type: SignupRequestDto })
  @ApiCreatedResponse({ type: SignupResponseDto })
  async signup(@Body() dto: SignupRequestDto): Promise<SignupResponseDto> {
    return this.authService.signup(dto);
  }

  // ── POST /auth/login ──────────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '로그인 + Access/Refresh Token 발급' })
  @ApiBody({ type: LoginRequestDto })
  @ApiOkResponse({ type: LoginResponseDto, description: '로그인 성공 — accessToken + refreshToken 발급' })
  @ApiUnauthorizedResponse({ description: '이메일 또는 비밀번호 불일치' })
  @ApiForbiddenResponse({ description: '로그인이 제한된 계정' })
  async login(
    @Body() dto: LoginRequestDto,
    @Req() req: Request, // Auth-UserAgent-Fix: Swagger에 노출 없이 header/IP 자동 추출
  ): Promise<LoginResponse> {
    const userAgent = req.headers['user-agent'];
    const ipAddress = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip;
    return this.authService.login(dto, { userAgent, ipAddress });
  }

  // ── POST /auth/refresh ────────────────────────────────────────────────────

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '리프레시 토큰으로 Access Token 재발급' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: { type: 'string', example: 'refresh-token-string' },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
      },
    },
    description: 'Access Token 재발급 성공',
  })
  @ApiUnauthorizedResponse({ description: '유효하지 않거나 만료된 Refresh Token' })
  async refresh(@Body() dto: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    return this.authService.refresh(dto);
  }

  // ── POST /auth/logout ─────────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '로그아웃 + Refresh Token 무효화' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: { type: 'string', example: 'refresh-token-string' },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '로그아웃되었습니다.' },
      },
    },
    description: '로그아웃 성공 (이미 만료된 토큰도 200 반환)',
  })
  @ApiUnauthorizedResponse({ description: '유효하지 않은 Refresh Token 형식' })
  async logout(@Body() dto: LogoutRequest): Promise<LogoutResponse> {
    return this.authService.logout(dto);
  }

  // ── POST /auth/social/login ───────────────────────────────────────────────

  @Post('social/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '소셜 로그인 — Provider OAuth 토큰으로 소셜 로그인 토큰 발급',
    description:
      'isNewUser=false: 기존 회원 → complete-profile 호출로 세션 발급 가능. ' +
      'isNewUser=true: 신규 회원 → complete-profile에 프로필 정보 포함하여 호출 필요.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['provider', 'providerToken'],
      properties: {
        provider: {
          type: 'string',
          enum: ['GOOGLE', 'KAKAO', 'NAVER'],
          example: 'KAKAO',
        },
        providerToken: {
          type: 'string',
          description:
            'GOOGLE: ID token / KAKAO: access token / NAVER: access token',
          example: 'provider-oauth-token',
        },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        isNewUser: { type: 'boolean', example: false },
      },
    },
    description: 'isNewUser=false: complete-profile 바로 호출 가능. true: 프로필 입력 필요.',
  })
  @ApiBadRequestResponse({ description: 'provider 오류' })
  @ApiResponse({ status: 401, description: '유효하지 않은 providerToken' })
  @ApiResponse({ status: 502, description: 'Provider 서버 일시 장애' })
  async socialLogin(@Body() dto: SocialLoginRequest): Promise<SocialLoginResponse> {
    return this.authService.socialLogin(dto);
  }

  // ── POST /auth/social/complete-profile ────────────────────────────────────

  @Post('social/complete-profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '소셜 로그인 프로필 완성 — 기존 회원 세션 발급 또는 신규 회원 가입',
    description:
      '【기존 회원 (isNewUser=false)】 provider + providerToken 만 전송하면 즉시 세션 발급.\n\n' +
      '【신규 회원 (isNewUser=true)】 nickname / birthDate / gender / phoneNumber / phoneVerificationToken(SIGN_UP) / password 모두 필수.\n\n' +
      '▸ password: 신규 소셜가입 시 앱 전용 비밀번호 설정 (8자 이상, 영문·숫자·특수문자 각 1개 이상).\n' +
      '▸ 기존 일반회원 이메일과 소셜 이메일이 일치하고 provider 에서 이메일 인증을 확인할 수 있는 경우에만 자동 연동 (기존 비밀번호 유지).\n' +
      '▸ provider 가 이메일을 반환하지 않으면 가입/연동 불가.\n' +
      '▸ providerToken 은 social/login 에 전달한 원본 token 을 그대로 사용.\n' +
      '▸ rememberMe=true → refresh token 발급 + 세션 저장 / false·미입력 → access token 만 발급.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['provider', 'providerToken'],
      properties: {
        provider: { type: 'string', enum: ['GOOGLE', 'KAKAO', 'NAVER'], example: 'KAKAO' },
        providerToken: {
          type: 'string',
          description: 'social/login 에 전달한 원본 Provider token (서버가 재검증)',
          example: 'kakao_access_token_here',
        },
        nickname: {
          type: 'string',
          example: '코디네이터',
          description: '신규 회원 전용 (isNewUser=true)',
        },
        birthDate: {
          type: 'string',
          format: 'date',
          example: '1995-07-20',
          description: '신규 회원 전용 (YYYY-MM-DD)',
        },
        gender: {
          type: 'string',
          enum: ['MALE', 'FEMALE'],
          example: 'MALE',
          description: '신규 회원 전용',
        },
        phoneNumber: {
          type: 'string',
          example: '01012345678',
          description: '신규 회원 전용',
        },
        phoneVerificationToken: {
          type: 'string',
          description: 'purpose=SIGN_UP 전화번호 인증 토큰 (신규 회원 전용)',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        password: {
          type: 'string',
          example: 'MyPass@123',
          description:
            '신규 회원 전용 필수. 앱 전용 비밀번호 — 8자 이상, 영문·숫자·특수문자 각 1개 이상. ' +
            '기존 일반회원 자동 연동(isNewUser=false) 시에는 전송하지 않아도 되며, 기존 비밀번호를 절대 덮어쓰지 않음.',
        },
        rememberMe: { // RememberMe
          type: 'boolean',
          example: true,
          description: '로그인 상태 유지. true → refresh token 발급 + 세션 저장. false·미입력 → access token만 발급.',
        },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { // RememberMe
          type: 'string',
          nullable: true,
          description: 'rememberMe=true 일 때만 포함',
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            email: { type: 'string', nullable: true },
            nickname: { type: 'string' },
          },
        },
        isNewUser: { type: 'boolean' },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      '토큰 오류 / 신규 회원 필수 필드 누락 / password 정책 불충족 / ' +
      'provider 이메일 미제공 / 이메일 인증 불가로 자동 연동 차단',
  })
  @ApiConflictResponse({ description: '이미 사용 중인 닉네임 또는 전화번호' })
  @ApiForbiddenResponse({ description: '로그인이 제한된 계정 또는 탈퇴 계정' })
  async socialCompleteProfile(
    @Body() dto: SocialCompleteProfileRequest,
    @Req() req: Request, // Auth-UserAgent-Fix
  ): Promise<SocialCompleteProfileResponse> {
    const userAgent = req.headers['user-agent'];
    const ipAddress = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip;
    return this.authService.socialCompleteProfile(dto, { userAgent, ipAddress });
  }

  // ── PATCH /auth/password-reset ────────────────────────────────────────────

  @Patch('password-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '비밀번호 재설정 — 전화번호 인증(PASSWORD_RESET) 후 새 비밀번호 설정',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['phoneNumber', 'phoneVerificationToken', 'newPassword'],
      properties: {
        phoneNumber: { type: 'string', example: '01012345678' },
        phoneVerificationToken: {
          type: 'string',
          description: 'purpose=PASSWORD_RESET 로 발급된 전화번호 인증 토큰',
        },
        newPassword: { type: 'string', example: 'NewPass1!' },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '비밀번호가 재설정되었습니다.' },
      },
    },
  })
  @ApiBadRequestResponse({ description: '토큰 오류, 비밀번호 정책 불충족, 또는 소셜 로그인 전용 계정' })
  @ApiNotFoundResponse({ description: '해당 전화번호로 가입된 계정 없음' })
  async passwordReset(@Body() dto: PasswordResetRequest): Promise<PasswordResetResponse> {
    return this.authService.passwordReset(dto);
  }

  // ── POST /auth/social/kakao/exchange-code ─────────────────────────────────
  // SocialCodeExchange

  @Post('social/kakao/exchange-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kakao 인가코드 교환 — code → access token → 소셜 로그인 판정',
    description:
      '프론트에서 Kakao 인가코드(code)를 받아 백엔드에서 access token 으로 교환하고, ' +
      '기존 회원 여부 판정까지 한 번에 처리합니다.\n\n' +
      '✅ **Swagger 테스트 방법 (개발 환경 / KAKAO_REAL_VERIFY_ENABLED=false)**\n' +
      '`code` 에 임의의 문자열(예: `test_kakao_001`), `redirectUri` 에 아무 URL 을 입력하세요. ' +
      '실제 Kakao API 를 호출하지 않고 stub token 을 반환합니다.\n\n' +
      '응답의 `providerToken` 을 POST /auth/social/complete-profile 의 `providerToken` 으로 그대로 사용하세요.',
  })
  @ApiBody({ type: ExchangeKakaoCodeDto })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        providerToken: {
          type: 'string',
          description: '교환된 Kakao access token. complete-profile 의 providerToken 으로 사용',
        },
        isNewUser: { type: 'boolean', example: false },
      },
    },
    description: '인가코드 교환 성공. isNewUser=false: 바로 complete-profile 호출 가능',
  })
  @ApiUnauthorizedResponse({ description: '유효하지 않거나 만료된 Kakao 인가코드' })
  @ApiBadRequestResponse({ description: 'code / redirectUri 누락' })
  @ApiResponse({ status: 502, description: 'Kakao 인증 서버 일시 장애' })
  async exchangeKakaoCode(
    @Body() dto: ExchangeKakaoCodeDto,
  ): Promise<SocialCodeExchangeResponse> {
    return this.authService.exchangeKakaoCode(dto);
  }

  // ── POST /auth/social/naver/exchange-code ─────────────────────────────────
  // SocialCodeExchange

  @Post('social/naver/exchange-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Naver 인가코드 교환 — code + state → access token → 소셜 로그인 판정',
    description:
      '프론트에서 Naver 인가코드(code)와 state 를 받아 백엔드에서 access token 으로 교환하고, ' +
      '기존 회원 여부 판정까지 한 번에 처리합니다.\n\n' +
      '✅ **Swagger 테스트 방법 (개발 환경 / NAVER_REAL_VERIFY_ENABLED=false)**\n' +
      '`code` 에 임의의 문자열(예: `test_naver_001`), `state` 에 아무 값, `redirectUri` 에 아무 URL 을 입력하세요. ' +
      '실제 Naver API 를 호출하지 않고 stub token 을 반환합니다.\n\n' +
      '응답의 `providerToken` 을 POST /auth/social/complete-profile 의 `providerToken` 으로 그대로 사용하세요.',
  })
  @ApiBody({ type: ExchangeNaverCodeDto })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        providerToken: {
          type: 'string',
          description: '교환된 Naver access token. complete-profile 의 providerToken 으로 사용',
        },
        isNewUser: { type: 'boolean', example: false },
      },
    },
    description: '인가코드 교환 성공. isNewUser=false: 바로 complete-profile 호출 가능',
  })
  @ApiUnauthorizedResponse({ description: '유효하지 않거나 만료된 Naver 인가코드' })
  @ApiBadRequestResponse({ description: 'code / state / redirectUri 누락' })
  @ApiResponse({ status: 502, description: 'Naver 인증 서버 일시 장애' })
  async exchangeNaverCode(
    @Body() dto: ExchangeNaverCodeDto,
  ): Promise<SocialCodeExchangeResponse> {
    return this.authService.exchangeNaverCode(dto);
  }
}
