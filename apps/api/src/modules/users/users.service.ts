import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  DeleteMeResponse,
  GetMeResponse,
  UpdateMeRequest,
  UpdateMeResponse,
  UpdatePasswordRequest,
  UpdatePasswordResponse,
} from '@codinator/contracts';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── 내 정보 조회 ─────────────────────────────────────────────────────────────

  async getMe(userId: number): Promise<GetMeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nickname: true,
        gender: true,
        birthDate: true,
        phoneNumber: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user || user.status === UserStatus.DELETED) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    return {
      userId: user.id,
      email: user.email,
      nickname: user.nickname,
      gender: user.gender,
      birthDate: user.birthDate.toISOString().slice(0, 10),
      phoneNumber: user.phoneNumber,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    };
  }

  // ─── 내 정보 수정 (nickname, phoneNumber) ─────────────────────────────────────

  async updateMe(userId: number, body: UpdateMeRequest): Promise<UpdateMeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });

    if (!user || user.status === UserStatus.DELETED) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const dataToUpdate: { nickname?: string; phoneNumber?: string } = {};

    if (body.nickname !== undefined) {
      const trimmed = body.nickname.trim();
      if (!trimmed) {
        throw new BadRequestException('닉네임은 빈 값일 수 없습니다.');
      }
      if (trimmed.length > 30) {
        throw new BadRequestException('닉네임은 최대 30자입니다.');
      }
      // 중복 검사 (본인 제외)
      const existing = await this.prisma.user.findFirst({
        where: { nickname: trimmed, NOT: { id: userId } },
        select: { id: true },
      });
      if (existing) {
        throw new BadRequestException('이미 사용 중인 닉네임입니다.');
      }
      dataToUpdate.nickname = trimmed;
    }

    if (body.phoneNumber !== undefined) {
      const normalized = this.normalizePhoneNumber(body.phoneNumber);
      // 중복 검사 (본인 제외)
      const existing = await this.prisma.user.findFirst({
        where: { phoneNumber: normalized, NOT: { id: userId } },
        select: { id: true },
      });
      if (existing) {
        throw new BadRequestException('이미 사용 중인 전화번호입니다.');
      }
      dataToUpdate.phoneNumber = normalized;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        nickname: true,
        gender: true,
        birthDate: true,
        phoneNumber: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    return {
      userId: updated.id,
      email: updated.email,
      nickname: updated.nickname,
      gender: updated.gender,
      birthDate: updated.birthDate.toISOString().slice(0, 10),
      phoneNumber: updated.phoneNumber,
      role: updated.role,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // ─── 회원 탈퇴 (소프트 삭제 + 세션 전체 무효화) ─────────────────────────────

  async deleteMe(userId: number): Promise<DeleteMeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });

    if (!user || user.status === UserStatus.DELETED) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const now = new Date();

    await this.prisma.$transaction([
      // 활성 세션 전체 무효화
      this.prisma.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      // 소프트 삭제
      this.prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.DELETED, deletedAt: now },
      }),
    ]);

    return { success: true, message: '회원 탈퇴가 완료되었습니다.' };
  }

  // ─── 비밀번호 변경 ────────────────────────────────────────────────────────────

  async updatePassword(
    userId: number,
    body: UpdatePasswordRequest,
  ): Promise<UpdatePasswordResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, passwordHash: true },
    });

    if (!user || user.status === UserStatus.DELETED) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const isValid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('현재 비밀번호가 올바르지 않습니다.');
    }

    // 정책 확인 필요: 새 비밀번호 최소 길이 기준 미정 → 최소 4자 적용 (임시)
    if (!body.newPassword || body.newPassword.length < 4) {
      throw new BadRequestException('새 비밀번호는 최소 4자 이상이어야 합니다.');
    }

    const newHash = await bcrypt.hash(body.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { success: true, message: '비밀번호가 변경되었습니다.' };
  }

  // ─── private helpers ──────────────────────────────────────────────────────────

  private normalizePhoneNumber(phoneNumber: string): string {
    const normalized = phoneNumber.replace(/[^0-9]/g, '');

    if (!normalized) {
      throw new BadRequestException('전화번호는 필수값입니다.');
    }

    if (normalized.length < 9 || normalized.length > 15) {
      throw new BadRequestException('전화번호 형식이 올바르지 않습니다.');
    }

    return normalized;
  }
}
