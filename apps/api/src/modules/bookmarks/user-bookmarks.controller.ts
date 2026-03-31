import { Controller, Get, Headers, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { GetMyBookmarksResponse } from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { GetBookmarksQueryDto } from './dto/get-bookmarks-query.dto';
import { BookmarksService } from './bookmarks.service';

@ApiTags('bookmarks')
@Controller('users')
export class UserBookmarksController {
  constructor(
    private readonly bookmarksService: BookmarksService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  // ─── GET /users/me/bookmarks ──────────────────────────────────────────────────

  @Get('me/bookmarks')
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 북마크 목록 조회 (커서 페이지네이션)' })
  @ApiQuery({ name: 'cursor', required: false, type: Number, description: '직전 페이지 마지막 bookmarkId' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '페이지 크기 (기본 20, 최대 50)' })
  @ApiOkResponse({
    description: '내 북마크 목록',
    schema: {
      example: {
        items: [
          {
            bookmarkId: 15,
            postId: 42,
            thumbnailUrl: '/uploads/posts/originals/20260325/image.jpg',
            content: '봄 코디 추천드려요',
            postStatus: 'ACTIVE',
            bookmarkedAt: '2026-03-28T10:00:00.000Z',
          },
          {
            bookmarkId: 14,
            postId: 38,
            thumbnailUrl: null,
            content: '오늘의 코디',
            postStatus: 'HIDDEN',
            bookmarkedAt: '2026-03-27T08:00:00.000Z',
          },
        ],
        nextCursor: 14,
        hasMore: true,
      },
    },
  })
  async getMyBookmarks(
    @Query() query: GetBookmarksQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<GetMyBookmarksResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.bookmarksService.getMyBookmarks(userId!, {
      cursor: query.cursor !== undefined ? Number(query.cursor) : undefined,
      limit: query.limit !== undefined ? Number(query.limit) : undefined,
    });
  }
}
