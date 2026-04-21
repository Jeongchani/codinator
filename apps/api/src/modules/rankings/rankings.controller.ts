import { Controller, Get, Headers, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type {
  GetPersonalizedRankingsResponse, // V3 Batch7
  GetRankingPostDetailResponse,
  GetRankingsResponse,
} from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { GetPersonalizedRankingsQueryDto } from './dto/get-personalized-rankings-query.dto'; // V3 Batch7
import { GetRankingPostQueryDto } from './dto/get-ranking-post-query.dto';
import { GetRankingsQueryDto } from './dto/get-rankings-query.dto';
import { RankingsService } from './rankings.service';

@ApiTags('rankings')
@Controller('rankings')
export class RankingsController {
  constructor(
    private readonly rankingsService: RankingsService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  // ─── GET /rankings?period= ────────────────────────────────────────────────────

  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary: '랭킹 목록 조회 (V3)',
    description: [
      '해당 기간(WEEKLY/MONTHLY)의 최신 READY 랭킹을 반환한다.',
      '공개 조건: posts.status=ACTIVE + hiddenAt IS NULL + publishedAt IS NOT NULL + evaluation.status=ENDED.',
      '※ 랭킹존 공개(ENDED 전체) ≠ 주간/월간 랭킹 집계(기간별 TOP N).',
      '삭제/숨김 게시글은 집계에서 제외된다.',
      '정렬 기준: 좋아요 수 우선, 동률이면 좋아요 비율, generatedAt DESC 최신 집계 우선.',
    ].join(' '),
  })
  @ApiQuery({ name: 'period', required: true, enum: ['WEEKLY', 'MONTHLY'] })
  @ApiOkResponse({
    description: '선택한 기간의 랭킹 목록 (rank ASC 정렬)',
    schema: {
      example: {
        period: 'WEEKLY',
        items: [
          {
            rank: 1,
            postId: 13,
            thumbnailUrl: '/uploads/posts/processed/20260325/ranked-post-1.jpg',
            likeCount: 12,
            dislikeCount: 3,
            totalCount: 15,
            likeRate: 0.8,
          },
        ],
      },
    },
  })
  async getRankings(
    @Query() query: GetRankingsQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<GetRankingsResponse> {
    this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.rankingsService.getRankings(query.period);
  }

  // ─── GET /rankings/personalized ──────────────────────────────────────────────
  // V3 Batch7: 개인화 추천 신규 endpoint. /rankings/:postId 보다 먼저 선언해야 한다.

  @Get('personalized')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '개인화 추천 목록 조회 (V3)',
    description: [
      '최근 북마크 → 최근 LIKE 투표 → 최근 검색 기록(TEXT) 순으로 키워드 신호를 추출하여 개인화 추천을 반환한다.', // V3 Batch7-Fix
      '신호 우선순위: 북마크(가장 높음) > 좋아요 > 검색 기록(가장 낮음).',
      '신호가 없는 신규 사용자는 likeRatio 기반 인기 게시글로 fallback.',
      '추천 풀: evaluation.status=ENDED + status=ACTIVE + publishedAt IS NOT NULL + hiddenAt IS NULL.',
      '※ rankingDetails 등재 여부와 무관하게 랭킹존 공개 조건을 사용한다.',
      '커서 기반 페이지네이션 (postId DESC).',
    ].join(' '),
  })
  @ApiQuery({ name: 'cursor', required: false, type: Number, description: '직전 페이지 마지막 postId' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '페이지 크기 (기본 20, 최대 50)' })
  @ApiOkResponse({
    description: '개인화 추천 게시글 목록',
    schema: {
      example: {
        items: [
          {
            postId: 42,
            thumbnailUrl: '/uploads/posts/processed/20260325/post.jpg',
            likeCount: 30,
            dislikeCount: 5,
            totalCount: 35,
            likeRate: 0.8571,
          },
          {
            postId: 37,
            thumbnailUrl: null,
            likeCount: 18,
            dislikeCount: 2,
            totalCount: 20,
            likeRate: 0.9,
          },
        ],
        nextCursor: 37,
        hasMore: true,
      },
    },
  })
  async getPersonalizedRankings(
    @Query() query: GetPersonalizedRankingsQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<GetPersonalizedRankingsResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.rankingsService.getPersonalizedRankings({
      cursor: query.cursor !== undefined ? Number(query.cursor) : undefined,
      limit: query.limit !== undefined ? Number(query.limit) : undefined,
      userId: userId!,
    });
  }

  // ─── GET /rankings/posts/:postId?period= ─────────────────────────────────────

  @Get('posts/:postId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '랭킹 게시글 상세 조회 (V3)',
    description: [
      '랭킹 문맥의 게시글 상세.',
      '공개 조건: status=ACTIVE + hiddenAt IS NULL + publishedAt IS NOT NULL + evaluation.status=ENDED.',
      '작성자 정보(author) 포함. canVote=false (랭킹존에서는 투표 불가).',
      'rankingPeriods 또는 ranking context로 Week Top 10 / Month Top 10 뱃지를 프론트에서 렌더링한다.',
    ].join(' '),
  })
  @ApiQuery({ name: 'period', required: true, enum: ['WEEKLY', 'MONTHLY'] })
  @ApiOkResponse({
    description: '랭킹 문맥의 게시글 상세 정보. 작성자 정보가 포함됨.',
    schema: {
      example: {
        postId: 13,
        author: {
          userId: 2,
          nickname: '밥',
        },
        content: '[SEED] 스트릿 코디 랭킹 테스트용 게시글 1',
        status: 'ACTIVE',
        createdAt: '2026-03-20T02:00:00.000Z',
        images: [
          {
            id: 102,
            originalImageUrl: '/uploads/posts/originals/20260325/ranked-post-1.jpg',
            processedImageUrl: '/uploads/posts/processed/20260325/ranked-post-1.jpg',
            thumbnailUrl: null,
            storageKey: 'posts/originals/20260325/ranked-post-1.jpg',
            blurMethod: 'AUTO',
            aiBlurStatus: 'DONE',
            sortOrder: 0,
            isPrimary: true,
          },
        ],
        keywords: [{ id: 4, code: 'STREET_LOOK', label: '스트릿룩', sortOrder: 0 }],
        outfitItems: [{ id: 4, category: 'OUTER', itemName: '블랙 레더 자켓', brand: 'ZARA' }],
        evaluation: {
          id: 6,
          status: 'ENDED',
          endsAt: '2026-03-13T12:00:00.000Z',
        },
        hasVoted: true,
        myVoteId: 21,
        myVoteChoice: 'LIKE',
        myFeedbackTagIds: [1],
        canVote: false,
        voteSummary: { likeCount: 12, dislikeCount: 3, totalCount: 15, likeRate: 0.8 },
        feedbackSummary: [
          { tagId: 4, code: 'NEG_COLOR_BAD', label: '색 조합이 아쉬워요', count: 1, voteChoice: 'DISLIKE' },
        ],
        ranking: {
          period: 'WEEKLY',
          rank: 1,
          startDate: '2026-03-13T00:00:00.000Z',
          endDate: '2026-03-20T00:00:00.000Z',
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
