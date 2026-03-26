import { Injectable } from '@nestjs/common';
import type { GetKeywordsResponse } from '@codinator/contracts';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class KeywordsService {
  constructor(private readonly prisma: PrismaService) {}

  async getKeywords(): Promise<GetKeywordsResponse> {
    const keywords = await this.prisma.keyword.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    return {
      items: keywords.map((keyword) => ({
        id: keyword.id,
        code: keyword.code,
        label: keyword.label,
        sortOrder: keyword.sortOrder,
      })),
    };
  }
}
