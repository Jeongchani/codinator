import { Body, Controller, Headers, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CreateFeedbackResponse } from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { FeedbackService } from './feedback.service';

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(
    private readonly feedbackService: FeedbackService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  @Post(':voteId')
  @ApiBearerAuth()
  @ApiOperation({ summary: '투표 피드백 선택' })
  async createFeedback(
    @Param('voteId', ParseIntPipe) voteId: number,
    @Body('tagId', ParseIntPipe) tagId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<CreateFeedbackResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.feedbackService.createFeedback(voteId, userId!, tagId);
  }
}
