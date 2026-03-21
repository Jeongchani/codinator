import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateVoteResponse, VoteChoice } from '@codinator/contracts';
import { EvaluationStatus, PostStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildVoteSummary } from '../evaluations/common/evaluation-summary.util';
import { validateVoteChoice } from './common/vote-choice.util';
import { mapVoteChoice } from '../../common/mappers/enums.mapper';

@Injectable()
export class VotesService {
  constructor(private readonly prisma: PrismaService) {}

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
}
