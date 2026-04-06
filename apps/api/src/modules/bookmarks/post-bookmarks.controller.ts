import {
  Controller,
  Delete,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { AddBookmarkResponse, RemoveBookmarkResponse } from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { BookmarksService } from './bookmarks.service';

@ApiTags('bookmarks')
@Controller('posts')
export class PostBookmarksController {
  constructor(
    private readonly bookmarksService: BookmarksService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  // ─── POST /posts/:postId/bookmarks ────────────────────────────────────────────

  @Post(':postId/bookmarks')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '북마크 추가 (이미 북마크된 경우 기존 id 반환)' })
  @ApiParam({ name: 'postId', type: Number, example: 12 })
  @ApiOkResponse({
    description: '북마크 추가 완료',
    schema: {
      example: { bookmarkId: 7 },
    },
  })
  async addBookmark(
    @Param('postId', ParseIntPipe) postId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<AddBookmarkResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.bookmarksService.addBookmark(userId!, postId);
  }

  // ─── DELETE /posts/:postId/bookmarks ──────────────────────────────────────────

  @Delete(':postId/bookmarks')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '북마크 삭제' })
  @ApiParam({ name: 'postId', type: Number, example: 12 })
  @ApiOkResponse({
    description: '북마크 삭제 완료',
    schema: {
      example: { success: true },
    },
  })
  async removeBookmark(
    @Param('postId', ParseIntPipe) postId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<RemoveBookmarkResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.bookmarksService.removeBookmark(userId!, postId);
  }
}