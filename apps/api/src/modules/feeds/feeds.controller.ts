import { Controller, Get, Headers, Param, ParseIntPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { GetMyFeedResponse } from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { FeedService } from './feeds.service';

@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(
    private readonly feedService: FeedService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  @Get('my')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '내 피드 조회',
    description: '내가 올린 게시글 목록을 최신순으로 조회합니다.',
  })
  @ApiOkResponse({
    description: '내 게시글 목록',
    schema: {
      example: {
        userId: 1,
        items: [
          {
            postId: 12,
            thumbnailUrl: 'https://images.example.com/posts/open-post.jpg',
            createdAt: '2026-03-20T02:00:00.000Z',
            evaluationStatus: 'OPEN',
            rankingPeriod: null,
          },
        ],
      },
    },
  })
  async getMyFeed(
    @Headers('authorization') authorization?: string,
  ): Promise<GetMyFeedResponse> {
    const userId =
      this.authTokenService.extractUserIdFromAuthorizationHeader(
        authorization,
        { required: true },
      );

    return this.feedService.getMyFeed(userId!);
  }

  @Get('user/:userId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '상대방 피드 조회',
    description:
      '다른 유저의 게시글 목록을 조회합니다. ' +
      '랭킹존에서 접근 가능하며, 투표 진행 중(OPEN)인 게시글은 제외됩니다.',
  })
  @ApiParam({ name: 'userId', description: '조회할 유저 ID', example: 2 })
  @ApiOkResponse({
    description: '상대방 게시글 목록 (투표 진행 중 제외)',
    schema: {
      example: {
        userId: 2,
        items: [
          {
            postId: 13,
            thumbnailUrl: 'https://images.example.com/posts/ranked-post-1.jpg',
            createdAt: '2026-03-20T02:00:00.000Z',
            evaluationStatus: 'ENDED',
            rankingPeriod: 'WEEKLY',
          },
        ],
      },
    },
  })
  async getUserFeed(
    @Param('userId', ParseIntPipe) userId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<GetMyFeedResponse> {
    this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );

    return this.feedService.getUserFeed(userId);
  }
}
