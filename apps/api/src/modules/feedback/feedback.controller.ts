import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type {
  CreateFeedbackResponse,
  GetTagsResponse,
} from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { GetTagsQueryDto } from './dto/get-tags-query.dto';
import { CreateFeedbackBodyDto } from './dto/create-feedback-body.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(
    private readonly feedbackService: FeedbackService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  @Get('tags')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '피드백 태그 목록 조회',
    description:
      '투표 타입(LIKE/DISLIKE)에 맞는 피드백 태그 목록을 조회합니다. ' +
      '좋아요 시 긍정 태그만, 싫어요 시 부정 태그만 반환됩니다.',
  })
  @ApiQuery({
    name: 'voteChoice',
    required: true,
    enum: ['LIKE', 'DISLIKE'],
    description: 'LIKE → 긍정 태그, DISLIKE → 부정 태그',
  })
  @ApiOkResponse({
    description: '투표 타입에 해당하는 피드백 태그 목록',
    schema: {
      example: {
        items: [
          {
            id: 1,
            code: 'POS_FIT_GOOD',
            label: '핏이 좋아요',
            polarity: 'POSITIVE',
            voteChoice: 'LIKE',
            isActive: true,
          },
          {
            id: 2,
            code: 'POS_POINT_GOOD',
            label: '포인트가 좋아요',
            polarity: 'POSITIVE',
            voteChoice: 'LIKE',
            isActive: true,
          },
        ],
      },
    },
  })
  async getTags(
    @Query() query: GetTagsQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<GetTagsResponse> {
    this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.feedbackService.getTags(query.voteChoice);
  }

  @Post(':voteId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '투표 피드백 태그 선택',
    description:
      '투표 후 피드백 태그를 1개 선택합니다. ' +
      '좋아요 투표에는 긍정 태그만, 싫어요 투표에는 부정 태그만 선택 가능합니다. ' +
      'v1에서는 게시글당 피드백 태그 1개만 가능합니다.',
  })
  @ApiBody({ type: CreateFeedbackBodyDto })
  @ApiOkResponse({
    description: '피드백 태그 선택 완료',
    schema: {
      example: {
        voteId: 5,
        selectedTagIds: [3],
      },
    },
  })
  async createFeedback(
    @Param('voteId', ParseIntPipe) voteId: number,
    @Body() body: CreateFeedbackBodyDto,
    @Headers('authorization') authorization?: string,
  ): Promise<CreateFeedbackResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );

    return this.feedbackService.createFeedback(voteId, userId!, body.tagId);
  }
}
