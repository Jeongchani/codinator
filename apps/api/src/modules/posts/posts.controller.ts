import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Query,} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags,} from '@nestjs/swagger';
import type {
  CreatePostResponse,
  GetEvaluationPostDetailResponse,
  GetPostDetailResponse,
  GetRankingPostDetailResponse,
} from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { EvaluationsService } from '../evaluations/evaluations.service';
import { RankingsService } from '../rankings/rankings.service';
import { CreatePostDto } from './dto/create-post.dto';
import { GetRankingPostQueryDto } from './dto/get-ranking-post-query.dto';
import { PostsService } from './posts.service';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly evaluationsService: EvaluationsService,
    private readonly rankingsService: RankingsService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '일반 게시글 작성' })
  @ApiBody({ type: CreatePostDto })
  @ApiCreatedResponse({
    description: '게시글 생성 완료',
    schema: {
      example: {
        postId: 14,
        evaluationId: 7,
        status: 'ACTIVE',
      },
    },
  })
  async createPost(
    @Body() body: CreatePostDto,
    @Headers('authorization') authorization?: string,
  ): Promise<CreatePostResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.postsService.createPost(userId!, body);
  }

  @Get(':postId')
  @ApiBearerAuth()
  @ApiOperation({ summary: '일반 게시글 상세 조회' })
  @ApiOkResponse({
    description: '일반 게시글 상세 정보',
    schema: {
      example: {
        postId: 12,
        authorId: 1,
        content: '봄 데일리 코디입니다.',
        status: 'ACTIVE',
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
      },
    },
  })
  async getPostDetail(
    @Param('postId', ParseIntPipe) postId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<GetPostDetailResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.postsService.getPostDetail(postId, userId!);
  }

  @Get(':postId/evaluation')
  @ApiBearerAuth()
  @ApiOperation({ summary: '평가 게시글 조회' })
  @ApiOkResponse({
    description: '평가 문맥의 게시글 상세 정보',
    schema: {
      example: {
        postId: 12,
        authorId: 1,
        content: '봄 데일리 코디 평가 부탁드립니다.',
        status: 'ACTIVE',
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
      },
    },
  })
  async getEvaluationPostDetail(
    @Param('postId', ParseIntPipe) postId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<GetEvaluationPostDetailResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.evaluationsService.getEvaluationPostDetail(postId, userId!);
  }

  @Get(':postId/ranking')
  @ApiBearerAuth()
  @ApiOperation({ summary: '랭킹 게시글 조회' })
  @ApiQuery({ name: 'period', required: true, enum: ['WEEKLY', 'MONTHLY'] })
  @ApiOkResponse({
    description: '랭킹 문맥의 게시글 상세 정보',
    schema: {
      example: {
        postId: 13,
        authorId: 2,
        content: '[SEED] 스트릿 코디 랭킹 테스트용 게시글 1',
        status: 'ACTIVE',
        createdAt: '2026-03-20T02:00:00.000Z',
        image: {
          id: 102,
          imageUrl: 'https://images.example.com/posts/ranked-post-1.jpg',
        },
        outfitItems: [
          {
            id: 4,
            category: 'OUTER',
            itemName: '블랙 레더 자켓',
            brand: 'ZARA',
          },
        ],
        evaluation: {
          id: 6,
          status: 'ENDED',
          endsAt: '2026-03-13T12:00:00.000Z',
        },
        hasVoted: true,
        canVote: false,
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
        ranking: {
          snapshotId: 1,
          period: 'WEEKLY',
          rank: 1,
          startDate: '2026-03-09T00:00:00.000Z',
          endDate: '2026-03-15T00:00:00.000Z',
        },
      },
    },
  })
  async getRankingPostDetail(
    @Param('postId', ParseIntPipe) postId: number,
    @Query() query: GetRankingPostQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<GetRankingPostDetailResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.rankingsService.getRankingPostDetail(postId, query.period, userId!);
  }
}
