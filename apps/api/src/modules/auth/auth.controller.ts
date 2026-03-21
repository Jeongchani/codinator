import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupRequestDto } from './dto/signup-request.dto';
import { SignupResponseDto } from './dto/signup-response.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { RefreshRequestDto } from './dto/refresh-request.dto';
import { LogoutRequestDto } from './dto/logout-request.dto';
import type {
  LoginResponse,
  RefreshTokenResponse,
  LogoutResponse,
} from '@codinator/contracts';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '회원가입',
    description: '이메일과 비밀번호로 새 계정을 생성합니다. 이미 가입된 이메일이면 400 에러를 반환합니다.',
  })
  @ApiBody({ type: SignupRequestDto })
  @ApiCreatedResponse({
    description: '회원가입 성공',
    type: SignupResponseDto,
  })
  async signup(@Body() dto: SignupRequestDto): Promise<SignupResponseDto> {
    return this.authService.signup(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '로그인 + Access/Refresh Token 발급',
    description:
      '이메일/비밀번호로 로그인합니다. ' +
      'Access Token(15분)과 Refresh Token(7일)이 발급됩니다.',
  })
  @ApiBody({ type: LoginRequestDto })
  @ApiOkResponse({
    description: '로그인 성공 + 토큰 발급',
    schema: {
      example: {
        user: { id: 1, email: 'alice@codinator.com' },
        accessToken: 'eyJhbGciOiJIUzI1NiIs...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIs...',
      },
    },
  })
  async login(@Body() dto: LoginRequestDto): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '리프레시 토큰으로 Access Token 재발급',
    description: 'Refresh Token을 보내면 새로운 Access Token을 반환합니다.',
  })
  @ApiBody({ type: RefreshRequestDto })
  @ApiOkResponse({
    description: '새 Access Token 발급 성공',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIs...',
      },
    },
  })
  async refresh(@Body() dto: RefreshRequestDto): Promise<RefreshTokenResponse> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '로그아웃 + 저장된 Refresh Token 무효화',
    description: 'Refresh Token을 무효화하여 재발급을 차단합니다.',
  })
  @ApiBody({ type: LogoutRequestDto })
  @ApiOkResponse({
    description: '로그아웃 성공',
    schema: {
      example: {
        success: true,
        message: '로그아웃 완료',
      },
    },
  })
  async logout(@Body() dto: LogoutRequestDto): Promise<LogoutResponse> {
    return this.authService.logout(dto);
  }
}
