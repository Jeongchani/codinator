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
  FeedbackTagPolarity,
  FeedbackTagCode,
} from '@codinator/contracts';
import { EvaluationStatus, PostStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildVoteSummary } from '../evaluations/common/evaluation-summary.util';
import { validateVoteChoice } from './common/vote-choice.util';
import { mapVoteChoice, mapEvaluationStatus } from '../../common/mappers/enums.mapper';

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
        code: tag.code as FeedbackTagCode,
        label: tag.label,
        polarity: tag.polarity as FeedbackTagPolarity,
        voteChoice: mapVoteChoice(tag.voteChoice),
        isActive: tag.isActive,
      })),
    };
  }

  async createVote(
    postId: number,
    voterId: number,
    choice: VoteChoice,
  ): Promise<CreateVoteResponse> {
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

    const alreadyVoted = evaluationPost.evaluation.votes.some(
      (vote) => vote.voterId === voterId,
    );
    if (alreadyVoted) {
      throw new BadRequestException('이미 투표한 게시글입니다.');
    }

    await this.prisma.vote.create({
      data: {
        evaluationId: evaluationPost.evaluation.id,
        voterId,
        choice,
      },
    });

    const refreshedVotes = await this.prisma.vote.findMany({
      where: { evaluationId: evaluationPost.evaluation.id },
    });

    return {
      postId: evaluationPost.id,
      myVote: choice,
      summary: buildVoteSummary(
        refreshedVotes.map((v) => ({
          ...v,
          choice: mapVoteChoice(v.choice),
        })),
      ),
    };
  }

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
      mapEvaluationStatus(vote.evaluation.status) !== EvaluationStatus.OPEN ||
      vote.evaluation.endsAt <= new Date()
    ) {
      throw new BadRequestException('이미 종료된 평가에는 피드백을 남길 수 없습니다.');
    }

    const tag = await this.prisma.feedbackTag.findFirst({
      where: {
        id: tagId,
        isActive: true,
      },
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
