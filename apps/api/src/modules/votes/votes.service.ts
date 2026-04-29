import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateFeedbackResponse,
  CreateVoteResponse,
  GetTagsResponse,
  VoteChoice,
} from '@codinator/contracts';
import { EvaluationStatus, PostStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildVoteSummary } from '../evaluations/common/evaluation-summary.util';
import { syncExpiredEvaluations } from '../evaluations/common/sync-expired-evaluations.util';
import { validateVoteChoice } from './common/vote-choice.util';
import { syncPostSearchIndex } from '../search/common/post-search-index.util';

@Injectable()
export class VotesService {
  constructor(private readonly prisma: PrismaService) {}

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
        code: tag.code,
        label: tag.label,
        groupCode: tag.groupCode,
        voteChoice: tag.voteChoice,
        isActive: tag.isActive,
        sortOrder: tag.sortOrder,
      })),
    };
  }

  async createVote(
    postId: number,
    voterId: number,
    choice: VoteChoice,
  ): Promise<CreateVoteResponse> {
    await syncExpiredEvaluations(this.prisma);
    validateVoteChoice(choice, 'choice');

    const evaluationPost = await this.prisma.post.findFirst({
      where: {
        id: postId,
        status: PostStatus.ACTIVE,
        deletedAt: null,
      },
      include: {
        evaluation: {
          include: {
            votes: true,
          },
        },
      },
    });

    if (!evaluationPost || !evaluationPost.evaluation) {
      throw new NotFoundException('평가 게시글을 찾을 수 없습니다.');
    }

    if (evaluationPost.authorId === voterId) {
      throw new ForbiddenException('본인 게시글에는 투표할 수 없습니다.');
    }

    if (
      evaluationPost.evaluation.status !== EvaluationStatus.OPEN ||
      evaluationPost.evaluation.endsAt <= new Date()
    ) {
      throw new BadRequestException('이미 종료된 평가입니다.');
    }

    const alreadyVoted = evaluationPost.evaluation.votes.some((vote) => vote.voterId === voterId);
    if (alreadyVoted) {
      throw new BadRequestException('이미 투표한 게시글입니다.');
    }

    const createdVote = await this.prisma.vote.create({
      data: {
        evaluationId: evaluationPost.evaluation.id,
        voterId,
        choice,
      },
    });

    const refreshedVotes = await this.prisma.vote.findMany({
      where: { evaluationId: evaluationPost.evaluation.id },
    });

    await syncPostSearchIndex(this.prisma, evaluationPost.id);

    return {
      postId: evaluationPost.id,
      voteId: createdVote.id,
      myVoteChoice: choice,
      myFeedbackTagIds: [],
      summary: buildVoteSummary(refreshedVotes),
    };
  }

  async createFeedback(
    voteId: number,
    voterId: number,
    tagIds: number[] | undefined,
  ): Promise<CreateFeedbackResponse> {
    await syncExpiredEvaluations(this.prisma);

    const vote = await this.prisma.vote.findUnique({
      where: { id: voteId },
      include: {
        evaluation: {
          include: {
            post: true,
          },
        },
        feedbacks: {
          select: {
            id: true,
          },
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

    if (vote.feedbackSubmittedAt || vote.feedbacks.length > 0) {
      throw new BadRequestException('피드백 태그는 한 번만 저장할 수 있습니다.');
    }

    const normalizedTagIds = this.normalizeTagIds(tagIds);

    const tags = normalizedTagIds.length
      ? await this.prisma.feedbackTag.findMany({
          where: {
            id: { in: normalizedTagIds },
            isActive: true,
          },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        })
      : [];

    if (tags.length !== normalizedTagIds.length) {
      throw new NotFoundException('피드백 태그를 찾을 수 없습니다.');
    }

    if (tags.some((tag) => tag.voteChoice !== vote.choice)) {
      throw new BadRequestException('선택한 투표와 맞지 않는 피드백 태그입니다.');
    }

    const submittedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (normalizedTagIds.length > 0) {
        await tx.feedback.createMany({
          data: normalizedTagIds.map((tagId, index) => ({
            voteId,
            tagId,
            sortOrder: index,
          })),
        });
      }

      await tx.vote.update({
        where: { id: voteId },
        data: {
          feedbackSubmittedAt: submittedAt,
        },
      });
    });

    await syncPostSearchIndex(this.prisma, vote.evaluation.post.id);

    return {
      postId: vote.evaluation.post.id,
      myVoteId: vote.id,
      myVoteChoice: vote.choice,
      selectedTagIds: normalizedTagIds,
      feedbackSubmitted: true,
    };
  }

  private normalizeTagIds(tagIds?: number[]): number[] {
    if (!tagIds?.length) {
      return [];
    }

    const normalized = tagIds.map((value) => Number(value));

    if (normalized.some((value) => !Number.isInteger(value) || value <= 0)) {
      throw new BadRequestException('tagIds는 양의 정수 배열이어야 합니다.');
    }

    const unique = Array.from(new Set(normalized));

    if (unique.length !== normalized.length) {
      throw new BadRequestException('중복된 피드백 태그는 선택할 수 없습니다.');
    }

    if (unique.length > 3) {
      throw new BadRequestException('피드백 태그는 최대 3개까지 선택할 수 있습니다.');
    }

    return unique;
  }
}
