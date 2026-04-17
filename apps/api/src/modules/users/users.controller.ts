import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type {
  ChangePhoneRequest,
  ChangePhoneResponse,
  DeleteMeResponse,
  GetMeResponse,
  UpdateMeResponse,
  UpdatePasswordResponse,
} from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  // ─── PATCH me/phone ───────────────────────────────────────────────────────

  @Patch('me/phone')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '전화번호 변경 — PHONE_CHANGE purpose 인증 토큰 필수',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['phoneNumber', 'phoneVerificationToken'],
      properties: {
        phoneNumber: { type: 'string', example: '01099998888' },
        phoneVerificationToken: {
          type: 'string',
          description: 'purpose=PHONE_CHANGE 로 발급된 전화번호 인증 토큰',
        },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '전화번호가 변경되었습니다.' },
        phoneNumber: { type: 'string', example: '01099998888' },
      },
    },
  })
  async changePhone(
    @Body() body: ChangePhoneRequest,
    @Headers('authorization') authorization?: string,
  ): Promise<ChangePhoneResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.usersService.changePhone(userId!, body);
  }

  // ─── PATCH me/password (me보다 먼저 선언 — 더 구체적인 경로 우선) ──────────────

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '비밀번호 변경' })
  @ApiBody({ type: UpdatePasswordDto })
  @ApiOkResponse({
    description: '비밀번호 변경 완료',
    schema: {
      example: {
        success: true,
        message: '비밀번호가 변경되었습니다.',
      },
    },
  })
  async updatePassword(
    @Body() body: UpdatePasswordDto,
    @Headers('authorization') authorization?: string,
  ): Promise<UpdatePasswordResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.usersService.updatePassword(userId!, body);
  }

  // ─── GET me ──────────────────────────────────────────────────────────────────

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 정보 조회' })
  @ApiOkResponse({
    description: '내 프로필 반환',
    schema: {
      example: {
        userId: 1,
        email: 'user@example.com',
        nickname: 'codinator_user',
        gender: 'MALE',
        birthDate: '2000-01-01',
        phoneNumber: '01012345678',
        role: 'USER',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    },
  })
  async getMe(
    @Headers('authorization') authorization?: string,
  ): Promise<GetMeResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.usersService.getMe(userId!);
  }

  // ─── PATCH me ────────────────────────────────────────────────────────────────

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 정보 수정 (닉네임, 전화번호)' })
  @ApiBody({ type: UpdateMeDto })
  @ApiOkResponse({
    description: '수정된 프로필 반환',
    schema: {
      example: {
        userId: 1,
        email: 'user@example.com',
        nickname: 'new_nickname',
        gender: 'MALE',
        birthDate: '2000-01-01',
        phoneNumber: '01098765432',
        role: 'USER',
        status: 'ACTIVE',
        updatedAt: '2026-03-30T10:00:00.000Z',
      },
    },
  })
  async updateMe(
    @Body() body: UpdateMeDto,
    @Headers('authorization') authorization?: string,
  ): Promise<UpdateMeResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.usersService.updateMe(userId!, body);
  }

  // ─── DELETE me ───────────────────────────────────────────────────────────────

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '회원 탈퇴 (소프트 삭제 + 세션 전체 무효화)' })
  @ApiOkResponse({
    description: '탈퇴 완료',
    schema: {
      example: {
        success: true,
        message: '회원 탈퇴가 완료되었습니다.',
      },
    },
  })
  async deleteMe(
    @Headers('authorization') authorization?: string,
  ): Promise<DeleteMeResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.usersService.deleteMe(userId!);
  }
}
