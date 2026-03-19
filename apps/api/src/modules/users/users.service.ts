import { Injectable } from '@nestjs/common';
import type { SeedCheckResponse } from '@codinator/contracts';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findSeedUserByEmail(email: string): Promise<SeedCheckResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    return {
      found: !!user,
      user: user
        ? {
            id: user.id,
            email: user.email,
            createdAt: user.createdAt.toISOString(),
          }
        : null,
    };
  }
}