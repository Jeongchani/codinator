import { Controller, Get, Headers, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { GetEvaluationsResponse, GetPostDetailResponse } from '@codinator/contracts';
import { AuthTokenService } from '../../auth/auth-token.service';
import { GetEvaluationsQueryDto } from '../dto/get-evaluations-query.dto';
import { EvaluationPostsService } from './posts.service';

@ApiTags('evaluations')
@Controller('evaluations')
export class EvaluationPostsController {
  constructor(
    private readonly postsService: EvaluationPostsService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  @Get()
  @ApiOperation({ summary: '평가존 목록 조회' })
  @ApiOkResponse({
    description: '진행 중인 평가 게시글 목록',
    schema: {
      example: {
        items: [
          {
            evaluationId: 1,
            postId: 12,
            thumbnailUrl: 'https://images.example.com/posts/open-post.jpg',
            endsAt: '2026-03-26T12:00:00.000Z',
            hasVoted: false,
          },
        ],
        nextCursor: null,
      },
    },
  })
  async getEvaluations(
    @Query() query: GetEvaluationsQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<GetEvaluationsResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization);

    return this.postsService.getEvaluations({
      cursor: query.cursor !== undefined ? Number(query.cursor) : undefined,
      limit: query.limit !== undefined ? Number(query.limit) : undefined,
      userId,
    });
  }

  @Get('posts/:postId')
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
