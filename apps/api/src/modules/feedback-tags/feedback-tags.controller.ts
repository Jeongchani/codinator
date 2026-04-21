import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { GetFeedbackTagsResponse } from '@codinator/contracts';
import { FeedbackTagsService } from './feedback-tags.service';

// Batch4: 피드백 태그 목록 조회 컨트롤러

@ApiTags('feedback-tags')
@Controller('feedback-tags')
export class FeedbackTagsController {
  constructor(private readonly feedbackTagsService: FeedbackTagsService) {}

  @Get()
  @ApiOperation({
    summary: '피드백 태그 목록 조회',
    description:
      '투표 시 사용할 LIKE/DISLIKE 피드백 태그 마스터 목록을 반환합니다. isActive=true 항목만 포함됩니다.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        items: [
          { id: 1, code: 'COLOR_GOOD', label: '색감이 좋아요', voteChoice: 'LIKE', groupCode: null, sortOrder: 0 },
          { id: 2, code: 'FIT_BAD', label: '핏이 별로예요', voteChoice: 'DISLIKE', groupCode: null, sortOrder: 0 },
        ],
      },
    },
  })
  async getFeedbackTags(): Promise<GetFeedbackTagsResponse> {
    return this.feedbackTagsService.getFeedbackTags();
  }
}
