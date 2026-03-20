import { Controller, Get, Headers, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { GetPostDetailResponse } from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { PostsService } from './posts.service';

@ApiTags('evaluations')
@Controller('evaluations/posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly authTokenService: AuthTokenService,
  ) {}


  @Get(':postId')
  @ApiOperation({ summary: '평가 게시글 상세 조회' })
  @ApiOkResponse({
    description: '평가 게시글 상세 정보',
    schema: {
      example: {
        postId: 12,
        authorId: 1,
        content: '봄 데일리 코디 평가 부탁드립니다.',
        createdAt: '2026-03-20T02:00:00.000Z',
        image: {
          id: 101,
          imageUrl: 'https://images.example.com/posts/open-post.jpg',
        },
        outfitItems: [
          {
            id: 1,
            category: 'TOP',
            itemName: '화이트 셔츠',
            brand: 'SPAO',
          },
        ],
        evaluation: {
          id: 5,
          status: 'OPEN',
          endsAt: '2026-03-26T12:00:00.000Z',
        },
        hasVoted: false,
        canVote: true,
        voteSummary: {
          likeCount: 2,
          dislikeCount: 1,
          totalCount: 3,
          likeRate: 0.6667,
        },
        feedbackSummary: [
          {
            tagId: 4,
            code: 'NEG_COLOR_BAD',
            label: '색 조합이 아쉬워요',
            count: 1,
          },
        ],
      },
    },
  })
  async getPostDetail(
    @Param('postId', ParseIntPipe) postId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<GetPostDetailResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization);
    return this.postsService.getPostDetail(postId, userId);
  }
}
