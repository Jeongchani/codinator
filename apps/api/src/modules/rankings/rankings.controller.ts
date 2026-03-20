import { Controller, Get, Headers, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type {
  GetRankingPostDetailResponse,
  GetRankingsResponse,
} from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
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

  @Get()
  @ApiOperation({ summary: '랭킹 목록 조회' })
  @ApiQuery({ name: 'period', required: true, enum: ['WEEKLY', 'MONTHLY'] })
  @ApiOkResponse({
    description: '선택한 기간의 최신 랭킹 목록',
    schema: {
      example: {
        period: 'WEEKLY',
        items: [
          {
            rank: 1,
            postId: 13,
            thumbnailUrl: 'https://images.example.com/posts/ranked-post-1.jpg',
            likeCount: 2,
            dislikeCount: 1,
            totalCount: 3,
            likeRate: 0.6667,
          },
        ],
      },
    },
  })
  async getRankings(@Query() query: GetRankingsQueryDto): Promise<GetRankingsResponse> {
    return this.rankingsService.getRankings(query.period);
  }

  @Get('posts/:postId')
  @ApiOperation({ summary: '랭킹 게시글 상세 조회' })
  @ApiQuery({ name: 'period', required: true, enum: ['WEEKLY', 'MONTHLY'] })
  @ApiOkResponse({
    description: '랭킹에 올라간 게시글 상세 정보',
    schema: {
      example: {
        postId: 13,
        authorId: 2,
        content: '[SEED] 스트릿 코디 랭킹 테스트용 게시글 1',
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
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization);

    return this.rankingsService.getRankingPostDetail(postId, query.period, userId);
  }
}
