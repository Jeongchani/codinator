import { Controller, Get, Headers, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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

  // ─── 내 피드 ─────────────────────────────────────────────────────────────────

  @Get('me/feed')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '내 피드 조회 (V3)',
    description: [
      '본인 게시글 전체 조회 (DELETED 제외).',
      'OPEN / HIDDEN / ENDED 상태 모두 포함.',
      '커서 기반 페이지네이션 (createdAt DESC).',
    ].join(' '),
  })
  @ApiQuery({ name: 'cursor', required: false, type: Number, description: '직전 페이지 마지막 postId' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '페이지 크기(기본 20, 최대 50)' })
  @ApiOkResponse({
    description: '본인 게시글 목록 (DELETED 제외, OPEN/HIDDEN/ENDED 포함)',
    schema: {
      example: {
        items: [
          {
            postId: 1,
            thumbnailUrl: '/uploads/posts/originals/20260325/image.jpg',
            content: '오늘의 코디입니다',
            postStatus: 'ACTIVE',
            evaluation: { evaluationId: 1, status: 'OPEN', endsAt: '2026-04-01T10:00:00Z' },
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
            evaluation: { evaluationId: 2, status: 'ENDED', endsAt: '2026-03-20T10:00:00Z' },
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

  // ─── 내 피드 게시글 상세 ─────────────────────────────────────────────────────

  @Get('me/feed/:postId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '내 피드 게시글 상세 조회 (소유자, V3)',
    description: [
      '본인 게시글은 OPEN / ENDED / CLOSED 상태 모두 조회 가능.',
      'HIDDEN 게시글도 조회 가능 (본인에게만 보임).',
      'DELETED는 조회 불가.',
    ].join(' '),
  })
  @ApiParam({ name: 'postId', type: Number, example: 12 })
  async getMyFeedPostDetail(
    @Param('postId', ParseIntPipe) postId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<GetFeedPostDetailResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.feedsService.getMyOwnFeedPostDetail(userId!, postId);
  }

  // ─── 타 사용자 피드 ──────────────────────────────────────────────────────────

  @Get(':userId/feed')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '타 사용자 피드 조회 (V3)',
    description: [
      'V3 공개 조건:',
      '- posts.status = ACTIVE (HIDDEN/DELETED 제외)',
      '- posts.hiddenAt IS NULL',
      '- posts.publishedAt IS NOT NULL',
      '- evaluations.status = ENDED',
      '※ rankingDetails 등재 여부와 무관.',
    ].join(' '),
  })
  @ApiParam({ name: 'userId', type: Number, example: 2 })
  @ApiOkResponse({ description: '공개 조건을 만족하는 타 사용자의 게시글 목록' })
  async getUserFeed(
    @Param('userId', ParseIntPipe) targetUserId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<GetUserFeedResponse> {
    const viewerUserId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.feedsService.getUserFeed(targetUserId, viewerUserId!);
  }

  // ─── 타 사용자 피드 게시글 상세 ─────────────────────────────────────────────

  @Get(':userId/feed/:postId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '타 사용자 피드 게시글 상세 조회 (V3)',
    description: [
      'V3 공개 조건:',
      '- posts.status = ACTIVE (HIDDEN/DELETED 제외)',
      '- posts.hiddenAt IS NULL',
      '- posts.publishedAt IS NOT NULL',
      '- evaluations.status = ENDED',
    ].join(' '),
  })
  @ApiParam({ name: 'userId', type: Number, example: 2 })
  @ApiParam({ name: 'postId', type: Number, example: 12 })
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
