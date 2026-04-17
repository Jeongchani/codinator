import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  GetSettingsResponse,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
} from '@codinator/contracts';
import { ThemeMode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── GET /users/me/settings ─────────────────────────────────────────────────

  /** Setting 행이 없으면 DB 기본값과 동일한 값을 반환 (lazy create 없음). */
  async getSettings(userId: number): Promise<GetSettingsResponse> {
    const setting = await this.prisma.setting.findUnique({
      where: { userId },
    });

    if (!setting) {
      return {
        theme: ThemeMode.LIGHT,
        pushEnabled: true,
        servicePushEnabled: true,
        marketingPushEnabled: false,
      };
    }

    return {
      theme: setting.theme,
      pushEnabled: setting.pushEnabled,
      servicePushEnabled: setting.servicePushEnabled,
      marketingPushEnabled: setting.marketingPushEnabled,
    };
  }

  // ── PATCH /users/me/settings ───────────────────────────────────────────────

  async updateSettings(
    userId: number,
    body: UpdateSettingsRequest,
  ): Promise<UpdateSettingsResponse> {
    const keys = ['theme', 'pushEnabled', 'servicePushEnabled', 'marketingPushEnabled'] as const;
    const hasAnyField = keys.some((k) => body[k] !== undefined);

    if (!hasAnyField) {
      throw new BadRequestException('변경할 설정 항목을 1개 이상 입력해 주세요.');
    }

    for (const k of keys) {
      if ((body as any)[k] === null) {
        throw new BadRequestException(`${k} 값은 null일 수 없습니다.`);
      }
    }

    const data: Partial<{
      theme: ThemeMode;
      pushEnabled: boolean;
      servicePushEnabled: boolean;
      marketingPushEnabled: boolean;
    }> = {};

    if (body.theme !== undefined) data.theme = body.theme as ThemeMode;
    if (body.pushEnabled !== undefined) data.pushEnabled = body.pushEnabled;
    if (body.servicePushEnabled !== undefined) data.servicePushEnabled = body.servicePushEnabled;
    if (body.marketingPushEnabled !== undefined) data.marketingPushEnabled = body.marketingPushEnabled;

    const updated = await this.prisma.setting.upsert({
      where: { userId },
      create: {
        userId,
        theme: data.theme ?? ThemeMode.LIGHT,
        pushEnabled: data.pushEnabled ?? true,
        servicePushEnabled: data.servicePushEnabled ?? true,
        marketingPushEnabled: data.marketingPushEnabled ?? false,
      },
      update: data,
    });

    return {
      theme: updated.theme,
      pushEnabled: updated.pushEnabled,
      servicePushEnabled: updated.servicePushEnabled,
      marketingPushEnabled: updated.marketingPushEnabled,
    };
  }
}
