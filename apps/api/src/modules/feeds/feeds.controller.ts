import { Controller, Get, Headers, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type {
  GetFeedPostDetailResponse,
  GetMyFeedResponse,
  GetUserFeedResponse,
} from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { GetMyFeedQueryDto } from './dto/get-my-feed-query.dto';
import { FeedsService } from './feeds.service';

@ApiTags('feeds')
@Controller('users')
export class FeedsController {
  constructor(
    private readonly feedsService: FeedsService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  // ─── 내 피드 (V2) ────────────────────────────────────────────────────────────

  @Get('me/feed')
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 피드 조회 (OPEN/HIDDEN/ENDED 전체 포함)' })
  @ApiQuery({ name: 'cursor', required: false, type: Number, description: '직전 페이지 마지막 postId' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '페이지 크기(기본 20, 최대 50)' })
  @ApiOkResponse({
    description: 'V2: 본인 게시글 전체(DELETED 제외). OPEN/HIDDEN/ENDED 포함.',
    schema: {
      example: {
        items: [
          {
            postId: 1,
            thumbnailUrl: '/uploads/posts/originals/20260325/image.jpg',
            content: '오늘의 코디입니다',
            postStatus: 'ACTIVE',
            evaluation: {
              evaluationId: 1,
              status: 'OPEN',
              endsAt: '2026-04-01T10:00:00Z',
            },
            voteSummary: { likeCount: 45, dislikeCount: 5 },
            isRankingPublished: false,
            rankInfo: null,
            createdAt: '2026-03-25T10:00:00Z',
          },
          {
            postId: 2,
            thumbnailUrl: '/uploads/posts/originals/20260318/image.jpg',
            content: '지난주 코디',
            postStatus: 'HIDDEN',
            evaluation: {
              evaluationId: 2,
              status: 'ENDED',
              endsAt: '2026-03-20T10:00:00Z',
            },
            voteSummary: { likeCount: 120, dislikeCount: 10 },
            isRankingPublished: true,
            rankInfo: { rank: 3, period: 'WEEKLY' },
            createdAt: '2026-03-18T10:00:00Z',
          },
        ],
        nextCursor: 2,
        hasMore: false,
      },
    },
  })
  async getMyFeed(
    @Query() query: GetMyFeedQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<GetMyFeedResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.feedsService.getMyOwnFeed(userId!, {
      cursor: query.cursor !== undefined ? Number(query.cursor) : undefined,
      limit: query.limit !== undefined ? Number(query.limit) : undefined,
    });
  }

  @Get('me/feed/:postId')
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 피드 게시글 상세 조회' })
  async getMyFeedPostDetail(
    @Param('postId', ParseIntPipe) postId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<GetFeedPostDetailResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.feedsService.getFeedPostDetail(userId!, postId, userId!);
  }

  // ─── 타 사용자 피드 (기존 유지) ───────────────────────────────────────────────

  @Get(':userId/feed')
  @ApiBearerAuth()
  @ApiOperation({ summary: '타 사용자 피드 조회 (랭킹 등재 게시글만)' })
  @ApiOkResponse({
    description: '랭킹에 노출된 사용자의 종료된 게시글 목록',
  })
  async getUserFeed(
    @Param('userId', ParseIntPipe) targetUserId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<GetUserFeedResponse> {
    const viewerUserId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.feedsService.getUserFeed(targetUserId, viewerUserId!);
  }

  @Get(':userId/feed/:postId')
  @ApiBearerAuth()
  @ApiOperation({ summary: '타 사용자 피드 게시글 상세 조회' })
  async getUserFeedPostDetail(
    @Param('userId', ParseIntPipe) targetUserId: number,
    @Param('postId', ParseIntPipe) postId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<GetFeedPostDetailResponse> {
    const viewerUserId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.feedsService.getFeedPostDetail(targetUserId, postId, viewerUserId!);
  }
}
