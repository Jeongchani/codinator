import {
  Body,
  Controller,
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
  GetSettingsResponse,
  UpdateSettingsResponse,
} from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('users')
@Controller('users/me/settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  // ── GET /users/me/settings ─────────────────────────────────────────────────

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 설정 조회 — 설정 미생성 시 기본값 반환' })
  @ApiOkResponse({
    schema: {
      example: {
        theme: 'LIGHT',
        pushEnabled: true,
        servicePushEnabled: true,
        marketingPushEnabled: false,
      },
    },
  })
  async getSettings(
    @Headers('authorization') authorization?: string,
  ): Promise<GetSettingsResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.settingsService.getSettings(userId!);
  }

  // ── PATCH /users/me/settings ───────────────────────────────────────────────

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '내 설정 수정 — 변경할 항목만 전송, 빈 body 불가',
  })
  @ApiBody({ type: UpdateSettingsDto })
  @ApiOkResponse({
    schema: {
      example: {
        theme: 'DARK',
        pushEnabled: true,
        servicePushEnabled: true,
        marketingPushEnabled: false,
      },
    },
  })
  async updateSettings(
    @Body() body: UpdateSettingsDto,
    @Headers('authorization') authorization?: string,
  ): Promise<UpdateSettingsResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.settingsService.updateSettings(userId!, body);
  }
}
