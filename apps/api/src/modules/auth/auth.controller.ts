import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SendPhoneVerificationDto } from './dto/send-phone-verification.dto';
import { SignupRequestDto } from './dto/signup-request.dto';
import { SignupResponseDto } from './dto/signup-response.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { VerifyPhoneCodeDto } from './dto/verify-phone-code.dto';
import {
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  LogoutRequest,
  LogoutResponse,
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
  async login(@Body() dto: LoginRequestDto): Promise<LoginResponse> {
    return this.authService.login(dto);
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
  async logout(@Body() dto: LogoutRequest): Promise<LogoutResponse> {
    return this.authService.logout(dto);
  }
}
