import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GetPostDetailResponse,
  VoteChoice as ContractVoteChoice,
} from '@codinator/contracts';
import {
  mapGarmentCategory,
  mapEvaluationStatus,
  mapVoteChoice,
} from '../../common/mappers/enums';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  async getPostDetail(postId: number): Promise<GetPostDetailResponse> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { outfitItems: true, evaluation: { include: { votes: true } } },
    });

    if (!post) {
      throw new Error(`Post with id ${postId} not found`);
    }

    return {
      postId: post.id,
      authorId: post.authorId,
      content: post.content,
      createdAt: post.createdAt.toISOString(),
      image: { id: 0, imageUrl: '' }, // 기본값
      outfitItems: post.outfitItems.map((item) => ({
        id: item.id,
        category: mapGarmentCategory(item.category), // ✅ 변환
        itemName: item.itemName,
        brand: item.brand,
      })),
      evaluation: {
        id: post.evaluation.id,
        status: mapEvaluationStatus(post.evaluation.status), // ✅ 변환
        endsAt: post.evaluation.endsAt.toISOString(),
      },
      hasVoted: false,
      canVote: true,
      voteSummary: this.buildVoteSummary(
        post.evaluation.votes.map((vote) => ({
          choice: mapVoteChoice(vote.choice), // ✅ 변환
        }))
      ),
      feedbackSummary: [],
    };
  }

  private buildVoteSummary(votes: { choice: ContractVoteChoice }[]) {
    return {
      likeCount: votes.filter((v) => v.choice === ContractVoteChoice.LIKE).length,
      dislikeCount: votes.filter((v) => v.choice === ContractVoteChoice.DISLIKE).length,
      totalCount: votes.length,
      likeRate: votes.length
        ? votes.filter((v) => v.choice === ContractVoteChoice.LIKE).length / votes.length
        : 0,
    };
  }
}
