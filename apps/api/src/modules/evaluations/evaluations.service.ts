import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateFeedbackResponse,
  CreateVoteResponse,
  FeedbackTagSummary,
  GetEvaluationsResponse,
  GetPostDetailResponse,
  GetTagsResponse,
  VoteChoice,
  VoteSummary,
} from '@codinator/contracts';
import { EvaluationStatus, PostStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EvaluationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvaluations(params: {
    cursor?: number;
    limit?: number;
    userId?: number | null;
  }): Promise<GetEvaluationsResponse> {
    const limit = this.normalizeLimit(params.limit);
    const cursor = params.cursor ?? 0;

    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        id: { gt: cursor },
        status: EvaluationStatus.OPEN,
        endsAt: { gt: new Date() },
        post: {
          status: PostStatus.ACTIVE,
          deletedAt: null,
        },
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
      include: {
        post: {
          include: {
            images: {
              orderBy: { id: 'asc' },
              take: 1,
            },
          },
        },
        votes: params.userId
          ? {
              where: { voterId: params.userId },
              select: { id: true },
            }
          : false,
      },
    });

    const hasNextPage = evaluations.length > limit;
    const pageItems = hasNextPage ? evaluations.slice(0, limit) : evaluations;

    return {
      items: pageItems.map((evaluation) => ({
        evaluationId: evaluation.id,
        postId: evaluation.postId,
        thumbnailUrl: evaluation.post.images[0]?.imageUrl ?? '',
        endsAt: evaluation.endsAt.toISOString(),
        hasVoted: params.userId ? evaluation.votes.length > 0 : false,
      })),
      nextCursor: hasNextPage ? pageItems[pageItems.length - 1]?.id ?? null : null,
    };
  }

  async getPostDetail(postId: number, userId?: number | null): Promise<GetPostDetailResponse> {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        status: PostStatus.ACTIVE,
        deletedAt: null,
      },
      include: {
        images: {
          orderBy: { id: 'asc' },
        },
        outfitItems: {
          orderBy: { id: 'asc' },
        },
        evaluation: {
          include: {
            votes: {
              include: {
                feedbackTags: {
                  include: {
                    tag: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!post || !post.evaluation) {
      throw new NotFoundException('평가 게시글을 찾을 수 없습니다.');
    }

    const myVote = userId
      ? post.evaluation.votes.find((vote) => vote.voterId === userId)
      : null;

    const isEvaluationOpen =
      post.evaluation.status === EvaluationStatus.OPEN && post.evaluation.endsAt > new Date();

    const voteSummary = this.buildVoteSummary(post.evaluation.votes);
    const feedbackSummary = this.buildFeedbackSummary(post.evaluation.votes);

    return {
      postId: post.id,
      authorId: post.authorId,
      content: post.content,
      createdAt: post.createdAt.toISOString(),
      image: {
        id: post.images[0]?.id ?? 0,
        imageUrl: post.images[0]?.imageUrl ?? '',
      },
      outfitItems: post.outfitItems.map((item) => ({
        id: item.id,
        category: item.category,
        itemName: item.itemName,
        brand: item.brand,
      })),
      evaluation: {
        id: post.evaluation.id,
        status: post.evaluation.status,
        endsAt: post.evaluation.endsAt.toISOString(),
      },
      hasVoted: !!myVote,
      canVote: !!userId && isEvaluationOpen && !myVote && post.authorId !== userId,
      voteSummary,
      feedbackSummary,
    };
  }

  async getTags(voteChoice: VoteChoice): Promise<GetTagsResponse> {
    if (voteChoice !== 'LIKE' && voteChoice !== 'DISLIKE') {
      throw new BadRequestException('voteChoice는 LIKE 또는 DISLIKE여야 합니다.');
    }

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
        code: tag.code as GetTagsResponse['items'][number]['code'],
        label: tag.label,
        polarity: tag.polarity,
        voteChoice: tag.voteChoice,
        isActive: tag.isActive,
      })),
    };
  }

  async createVote(
    postId: number,
    voterId: number,
    choice: VoteChoice,
  ): Promise<CreateVoteResponse> {
    if (choice !== 'LIKE' && choice !== 'DISLIKE') {
      throw new BadRequestException('choice는 LIKE 또는 DISLIKE여야 합니다.');
    }

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
      summary: this.buildVoteSummary(refreshedVotes),
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
          include: {
            post: true,
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
      await tx.voteFeedbackTag.deleteMany({
        where: { voteId },
      });

      await tx.voteFeedbackTag.create({
        data: {
          voteId,
          tagId,
        },
      });
    });

    return {
      postId: vote.evaluation.post.id,
      selectedTagId: tagId,
    };
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || Number.isNaN(Number(limit))) {
      return 10;
    }

    return Math.min(Math.max(Number(limit), 1), 30);
  }

  private buildVoteSummary(votes: Array<{ choice: VoteChoice }>): VoteSummary {
    const likeCount = votes.filter((vote) => vote.choice === 'LIKE').length;
    const dislikeCount = votes.filter((vote) => vote.choice === 'DISLIKE').length;
    const totalCount = votes.length;
    const likeRate = totalCount === 0 ? 0 : Number((likeCount / totalCount).toFixed(4));

    return {
      likeCount,
      dislikeCount,
      totalCount,
      likeRate,
    };
  }

  private buildFeedbackSummary(
    votes: Array<{
      feedbackTags: Array<{
        tag: { id: number; code: string; label: string };
      }>;
    }>,
  ): FeedbackTagSummary[] {
    const summaryMap = new Map<number, FeedbackTagSummary>();

    for (const vote of votes) {
      for (const feedbackTag of vote.feedbackTags) {
        const current = summaryMap.get(feedbackTag.tag.id);

        if (current) {
          current.count += 1;
          continue;
        }

        summaryMap.set(feedbackTag.tag.id, {
          tagId: feedbackTag.tag.id,
          code: feedbackTag.tag.code,
          label: feedbackTag.tag.label,
          count: 1,
        });
      }
    }

    return Array.from(summaryMap.values()).sort((a, b) => b.count - a.count || a.tagId - b.tagId);
  }
}
