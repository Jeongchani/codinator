import { Controller, Get, Headers, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { GetEvaluationHistoryResponse } from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { GetEvaluationHistoryQueryDto } from './dto/get-evaluation-history-query.dto';
import { EvaluationsService } from './evaluations.service';

@ApiTags('evaluations')
@Controller('users')
export class UserEvaluationHistoryController {
  constructor(
    private readonly evaluationsService: EvaluationsService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  @Get('me/evaluation-history')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '내 진행중인 평가 참여 기록 조회 (V3)',
    description: [
      '내가 이미 투표한 게시글 중 evaluation.status = OPEN 인 게시글만 반환한다.',
      '평가가 완료(ENDED/CLOSED)되면 이 목록에서 자동 제외된다.',
      '과거 평가완료 기록은 보존하지 않는다.',
      '커서 기반 페이지네이션 (voteId DESC).',
    ].join(' '),
  })
  @ApiQuery({ name: 'cursor', required: false, type: Number, description: '직전 페이지 마지막 voteId' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '페이지 크기 (기본 10, 최대 30)' })
  @ApiOkResponse({
    description: '내가 투표한 진행중(OPEN) 평가 목록',
    schema: {
      example: {
        items: [
          {
            evaluationId: 5,
            postId: 12,
            thumbnailUrl: '/uploads/posts/processed/20260325/open-post.jpg',
            endsAt: '2026-04-20T12:00:00.000Z',
            evaluationStatus: 'OPEN',
            myVoteId: 31,
            myVoteChoice: 'DISLIKE',
            myFeedbackTagIds: [4],
          },
        ],
        nextCursor: null,
        hasMore: false,
      },
    },
  })
  async getMyEvaluationHistory(
    @Query() query: GetEvaluationHistoryQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<GetEvaluationHistoryResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.evaluationsService.getMyEvaluationHistory({
      cursor: query.cursor !== undefined ? Number(query.cursor) : undefined,
      limit: query.limit !== undefined ? Number(query.limit) : undefined,
      userId: userId!,
    });
  }
}
