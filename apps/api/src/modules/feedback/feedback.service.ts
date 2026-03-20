import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import type { CreateFeedbackResponse } from '@codinator/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { EvaluationStatus } from '@prisma/client';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async createFeedback(
    voteId: number,
    voterId: number,
    tagId: number,
  ): Promise<CreateFeedbackResponse> {
    const vote = await this.prisma.vote.findUnique({
      where: { id: voteId },
      include: {
        evaluation: {
          include: { post: true },
        },
      },
    });

    if (!vote) {
      throw new NotFoundException('투표 정보를 찾을 수 없습니다.');
    }

    if (vote.voterId !== voterId) {
      throw new ForbiddenException('본인 투표에만 피드백을 선택할 수 있습니다.');
    }

    if (
      vote.evaluation.status !== EvaluationStatus.OPEN ||
      vote.evaluation.endsAt <= new Date()
    ) {
      throw new BadRequestException('이미 종료된 평가에는 피드백을 남길 수 없습니다.');
    }

    const tag = await this.prisma.feedbackTag.findFirst({
      where: { id: tagId, isActive: true },
    });

    if (!tag) {
      throw new NotFoundException('피드백 태그를 찾을 수 없습니다.');
    }

    if (tag.voteChoice !== vote.choice) {
      throw new BadRequestException('선택한 투표와 맞지 않는 피드백 태그입니다.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.voteFeedbackTag.deleteMany({ where: { voteId } });
      await tx.voteFeedbackTag.create({ data: { voteId, tagId } });
    });

return {
  voteId,
  selectedTagIds: [tagId],
};
  }
}
