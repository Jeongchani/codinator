import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  DeletePushTokenResponse,
  GetPushTokensResponse,
  PushTokenItem,
  RegisterPushTokenRequest,
  RegisterPushTokenResponse,
} from '@codinator/contracts';
import { PushDevice, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PushTokensService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Private helper ────────────────────────────────────────────────────────

  /**
   * P0: ACTIVE 상태 user만 통과시키는 헬퍼.
   * DELETED / SUSPENDED 모두 차단.
   */
  private async assertActiveUser(userId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('사용할 수 없는 계정입니다. 고객센터에 문의해 주세요.');
    }
  }

  // ── POST /users/me/push-tokens ─────────────────────────────────────────────

  async registerPushToken(
    userId: number,
    body: RegisterPushTokenRequest,
  ): Promise<RegisterPushTokenResponse> {
    await this.assertActiveUser(userId); // P0

    const existing = await this.prisma.pushToken.findUnique({
      where: { pushToken: body.pushToken },
    });

    if (existing) {
      if (existing.userId !== userId) {
        throw new ConflictException('이미 다른 사용자에 등록된 푸시 토큰입니다.');
      }

      // 같은 사용자 — deviceOs 업데이트 + 재활성화
      const updated = await this.prisma.pushToken.update({
        where: { id: existing.id },
        data: { isActive: true, deviceOs: body.deviceOs as PushDevice },
      });

      return {
        id: updated.id,
        pushToken: updated.pushToken,
        deviceOs: updated.deviceOs,
        isActive: updated.isActive,
        createdAt: updated.createdAt.toISOString(),
      };
    }

    const created = await this.prisma.pushToken.create({
      data: {
        userId,
        pushToken: body.pushToken,
        deviceOs: body.deviceOs as PushDevice,
        isActive: true,
      },
    });

    return {
      id: created.id,
      pushToken: created.pushToken,
      deviceOs: created.deviceOs,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
    };
  }

  // ── GET /users/me/push-tokens ──────────────────────────────────────────────

  async getPushTokens(userId: number, deviceOs?: PushDevice): Promise<GetPushTokensResponse> {
    await this.assertActiveUser(userId); // P0

    const where: { userId: number; isActive: boolean; deviceOs?: PushDevice } = {
      userId,
      isActive: true,
    };

    if (deviceOs) {
      where.deviceOs = deviceOs;
    }

    const tokens = await this.prisma.pushToken.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const items: PushTokenItem[] = tokens.map((t) => ({
      id: t.id,
      pushToken: t.pushToken,
      deviceOs: t.deviceOs,
      isActive: t.isActive,
      createdAt: t.createdAt.toISOString(),
    }));

    return { items };
  }

  // ── DELETE /users/me/push-tokens/:tokenId ──────────────────────────────────

  async deletePushToken(userId: number, tokenId: number): Promise<DeletePushTokenResponse> {
    await this.assertActiveUser(userId); // P0

    const token = await this.prisma.pushToken.findUnique({
      where: { id: tokenId },
    });

    if (!token || token.userId !== userId) {
      throw new NotFoundException('푸시 토큰을 찾을 수 없습니다.');
    }

    if (!token.isActive) {
      throw new ConflictException('이미 비활성화된 푸시 토큰입니다.');
    }

    await this.prisma.pushToken.update({
      where: { id: tokenId },
      data: { isActive: false },
    });

    return { success: true, message: '푸시 토큰이 삭제되었습니다.' };
  }
}
