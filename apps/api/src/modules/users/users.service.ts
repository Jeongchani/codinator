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
import { isValidPassword } from '../../common/helpers/password.helper';
import { syncAuthorSearchIndexes } from '../search/common/post-search-index.util';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  async updateMe(userId: number, body: UpdateMeRequest): Promise<UpdateMeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });

    if (!user || user.status === UserStatus.DELETED) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const dataToUpdate: { nickname?: string } = {};
    let nicknameChanged = false;

    if (body.nickname !== undefined) {
      const trimmed = body.nickname.trim();
      if (!trimmed) {
        throw new BadRequestException('닉네임은 빈 값일 수 없습니다.');
      }
      if (trimmed.length > 30) {
        throw new BadRequestException('닉네임은 최대 30자입니다.');
      }
      const existing = await this.prisma.user.findFirst({
        where: { nickname: trimmed, NOT: { id: userId } },
        select: { id: true },
      });
      if (existing) {
        throw new BadRequestException('이미 사용 중인 닉네임입니다.');
      }
      dataToUpdate.nickname = trimmed;
      nicknameChanged = true;
    }

    // phoneNumber 변경은 V3 정책에 따라 PATCH /users/me/phone 에서만 처리

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

    if (nicknameChanged) {
      await syncAuthorSearchIndexes(this.prisma, userId);
    }

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
      this.prisma.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.DELETED, deletedAt: now },
      }),
    ]);

    return { success: true, message: '회원 탈퇴가 완료되었습니다.' };
  }

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

    if (!user.passwordHash) {
      throw new BadRequestException('비밀번호 기반 계정이 아닙니다.');
    }

    const isValid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('현재 비밀번호가 올바르지 않습니다.');
    }

    if (!isValidPassword(body.newPassword)) {
      throw new BadRequestException(
        '새 비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.',
      );
    }

    const newHash = await bcrypt.hash(body.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { success: true, message: '비밀번호가 변경되었습니다.' };
  }

}
