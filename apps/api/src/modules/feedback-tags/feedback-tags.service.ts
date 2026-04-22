import { Injectable } from '@nestjs/common';
import type { GetFeedbackTagsResponse } from '@codinator/contracts';
import { PrismaService } from '../../prisma/prisma.service';

// Batch4: 피드백 태그 목록 조회 서비스

@Injectable()
export class FeedbackTagsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 활성(isActive=true) 피드백 태그 목록을 voteChoice·sortOrder·id 순으로 반환.
   * vote_choice별 운영형 마스터: LIKE/DISLIKE 태그를 분리해서 전달.
   */
  async getFeedbackTags(): Promise<GetFeedbackTagsResponse> {
    const tags = await this.prisma.feedbackTag.findMany({
      where: { isActive: true },
      orderBy: [
        { voteChoice: 'asc' }, // DISLIKE → LIKE 알파벳 순
        { sortOrder: 'asc' },
        { id: 'asc' },
      ],
    });

    return {
      items: tags.map((tag) => ({
        id: tag.id,
        code: tag.code,
        label: tag.label,
        voteChoice: tag.voteChoice,
        groupCode: tag.groupCode ?? null,
        sortOrder: tag.sortOrder,
      })),
    };
  }
}
