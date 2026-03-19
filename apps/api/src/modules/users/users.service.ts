import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {} // DB 연결 (DI): Nest가 PrismaService 인스턴스를 주입

  async findSeedUserByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        gender: true,
        birthDate: true,
        phoneNumber: true,
        createdAt: true,
      },
    });

    return {
      found: !!user,
      user,
    };
  }
}