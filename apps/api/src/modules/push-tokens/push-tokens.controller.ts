import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type {
  DeletePushTokenResponse,
  GetPushTokensResponse,
  RegisterPushTokenRequest,
  RegisterPushTokenResponse,
} from '@codinator/contracts';
import { PushDevice } from '@prisma/client';
import { AuthTokenService } from '../auth/auth-token.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { PushTokensService } from './push-tokens.service';

@ApiTags('users')
@Controller('users/me/push-tokens')
export class PushTokensController {
  constructor(
    private readonly pushTokensService: PushTokensService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  // ── POST /users/me/push-tokens ─────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '푸시 토큰 등록 — 동일 토큰 재등록 시 재활성화, 타 사용자 토큰이면 409',
  })
  @ApiBody({ type: RegisterPushTokenDto })
  @ApiCreatedResponse({
    schema: {
      example: {
        id: 1,
        pushToken: 'fcm-token-abc123',
        deviceOs: 'IOS',
        isActive: true,
        createdAt: '2026-04-18T00:00:00.000Z',
      },
    },
  })
  @ApiConflictResponse({ description: '이미 다른 사용자에 등록된 토큰' })
  async registerPushToken(
    @Body() body: RegisterPushTokenDto,
    @Headers('authorization') authorization?: string,
  ): Promise<RegisterPushTokenResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.pushTokensService.registerPushToken(userId!, body as RegisterPushTokenRequest);
  }

  // ── GET /users/me/push-tokens ──────────────────────────────────────────────

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 푸시 토큰 목록 조회 (isActive=true 만 반환)' })
  @ApiQuery({
    name: 'deviceOs',
    required: false,
    enum: PushDevice,
    description: '디바이스 OS 필터 (없으면 전체)',
  })
  @ApiOkResponse({
    schema: {
      example: {
        items: [
          {
            id: 1,
            pushToken: 'fcm-token-abc123',
            deviceOs: 'IOS',
            isActive: true,
            createdAt: '2026-04-18T00:00:00.000Z',
          },
        ],
      },
    },
  })
  async getPushTokens(
    @Query('deviceOs', new ParseEnumPipe(PushDevice, { optional: true })) deviceOs?: PushDevice,
    @Headers('authorization') authorization?: string,
  ): Promise<GetPushTokensResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.pushTokensService.getPushTokens(userId!, deviceOs);
  }

  // ── DELETE /users/me/push-tokens/:tokenId ──────────────────────────────────

  @Delete(':tokenId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '푸시 토큰 비활성화 (소프트 삭제)' })
  @ApiParam({ name: 'tokenId', type: 'number', example: 1 })
  @ApiOkResponse({
    schema: {
      example: {
        success: true,
        message: '푸시 토큰이 삭제되었습니다.',
      },
    },
  })
  @ApiNotFoundResponse({ description: '토큰을 찾을 수 없음' })
  @ApiConflictResponse({ description: '이미 비활성화된 토큰' })
  async deletePushToken(
    @Param('tokenId', ParseIntPipe) tokenId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<DeletePushTokenResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.pushTokensService.deletePushToken(userId!, tokenId);
  }
}
