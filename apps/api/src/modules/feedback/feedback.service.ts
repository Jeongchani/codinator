import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateFeedbackResponse,
  GetTagsResponse,
  VoteChoice,
  FeedbackTagCode,
  FeedbackTagPolarity,
} from '@codinator/contracts';
import { EvaluationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { validateVoteChoice } from '../votes/common/vote-choice.util';
import { mapVoteChoice } from '../../common/mappers/enums.mapper';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  /** 투표 타입(LIKE/DISLIKE)에 맞는 피드백 태그 목록 조회 */
  async getTags(voteChoice: VoteChoice): Promise<GetTagsResponse> {
    validateVoteChoice(voteChoice, 'voteChoice');

    const tags = await this.prisma.feedbackTag.findMany({
      where: {
        voteChoice,
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    return {
      items: tags.map((tag) => ({
        id: tag.id,
        code: tag.code as FeedbackTagCode,
        label: tag.label,
        polarity: tag.polarity as FeedbackTagPolarity,
        voteChoice: mapVoteChoice(tag.voteChoice),
        isActive: tag.isActive,
      })),
    };
  }

  /** 투표에 피드백 태그 1개 선택 (v1: 1개만 가능) */
  async createFeedback(
    voteId: number,
    voterId: number,
    tagId: number,
  ): Promise<CreateFeedbackResponse> {
    // 1. 투표 존재 여부 + 평가 상태 확인
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

    // 2. 본인 투표인지 확인
    if (vote.voterId !== voterId) {
      throw new ForbiddenException('본인 투표에만 피드백을 선택할 수 있습니다.');
    }

    // 3. 평가가 진행 중인지 확인
    if (
      vote.evaluation.status !== EvaluationStatus.OPEN ||
      vote.evaluation.endsAt <= new Date()
    ) {
      throw new BadRequestException(
        '이미 종료된 평가에는 피드백을 남길 수 없습니다.',
      );
    }

    // 4. 태그 존재 + 활성 여부 확인
    const tag = await this.prisma.feedbackTag.findFirst({
      where: { id: tagId, isActive: true },
    });

    if (!tag) {
      throw new NotFoundException('피드백 태그를 찾을 수 없습니다.');
    }

    // 5. 투표 타입과 태그 극성 일치 확인
    if (tag.voteChoice !== vote.choice) {
      throw new BadRequestException(
        '선택한 투표와 맞지 않는 피드백 태그입니다.',
      );
    }

    // 6. 기존 피드백 삭제 후 새로 생성 (v1: 1개만 허용)
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
