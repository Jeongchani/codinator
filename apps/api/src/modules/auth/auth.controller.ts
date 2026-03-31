import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupRequestDto } from './dto/signup-request.dto';
import { SignupResponseDto } from './dto/signup-response.dto';
import { LoginRequestDto } from './dto/login-request.dto';
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

  @Post('signup/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '회원가입 입력값 사용 가능 여부 확인' })
  @ApiBody({
    schema: {
      type: 'object',
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
      required: ['type', 'value'],
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

  @Post('signup')
  @ApiOperation({ summary: '회원가입' })
  @ApiBody({ type: SignupRequestDto })
  @ApiOkResponse({ type: SignupResponseDto })
  async signup(@Body() dto: SignupRequestDto): Promise<SignupResponseDto> {
    return this.authService.signup(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '로그인 + Access/Refresh Token 발급' })
  @ApiBody({ type: LoginRequestDto })
  async login(@Body() dto: LoginRequestDto): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '리프레시 토큰으로 Access Token 재발급' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          example: 'refresh-token-string',
        },
      },
      required: ['refreshToken'],
    },
  })
  async refresh(@Body() dto: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '로그아웃 + 저장된 Refresh Token 무효화' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          example: 'refresh-token-string',
        },
      },
      required: ['refreshToken'],
    },
  })
  async logout(@Body() dto: LogoutRequest): Promise<LogoutResponse> {
    return this.authService.logout(dto);
  }
}