import { Controller, Get, Headers } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: '내 피드 조회' })
  async getMyFeed(
    @Headers('authorization') authorization?: string,
  ): Promise<GetMyFeedResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.feedService.getMyFeed(userId!);
  }
}
