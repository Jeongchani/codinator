import { Controller, Get, Headers, Param, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { GetFeedPostDetailResponse, GetUserFeedResponse } from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { FeedsService } from './feeds.service';

@ApiTags('feeds')
@Controller('users')
export class FeedsController {
  constructor(
    private readonly feedsService: FeedsService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  @Get('me/feed')
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 피드 조회' })
  @ApiOkResponse({
    description: '평가가 종료된 내 게시글 목록',
  })
  async getMyFeed(@Headers('authorization') authorization?: string): Promise<GetUserFeedResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.feedsService.getUserFeed(userId!, userId!);
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

  @Get(':userId/feed')
  @ApiBearerAuth()
  @ApiOperation({ summary: '다른 사용자 피드 조회' })
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
  @ApiOperation({ summary: '피드 게시글 상세 조회' })
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
