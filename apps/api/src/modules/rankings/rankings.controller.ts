import { Controller, Get, Headers, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { GetRankingPostDetailResponse, GetRankingsResponse } from '@codinator/contracts';
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
  @ApiBearerAuth()
  @ApiOperation({ summary: '랭킹 목록 조회' })
  @ApiQuery({ name: 'period', required: true, enum: ['WEEKLY', 'MONTHLY'] })
  @ApiOkResponse({
    description: '선택한 기간의 랭킹 목록',
    schema: {
      example: {
        period: 'WEEKLY',
        items: [
          {
            rank: 1,
            postId: 13,
            thumbnailUrl: 'https://images.example.com/posts/ranked-post-1.jpg',
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

  @Get('posts/:postId')
  @ApiBearerAuth()
  @ApiOperation({ summary: '랭킹 게시글 상세 조회' })
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
          likeCount: 12,
          dislikeCount: 3,
          totalCount: 15,
          likeRate: 0.8,
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
