import { Controller, Get, Headers, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { GetRankingsResponse } from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
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
  async getRankings(
    @Query() query: GetRankingsQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<GetRankingsResponse> {
    this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.rankingsService.getRankings(query.period);
  }
}
