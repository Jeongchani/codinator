import { Controller, Get, Headers, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { GetEvaluationsResponse } from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { GetEvaluationsQueryDto } from './dto/get-evaluations-query.dto';
import { EvaluationsService } from './evaluations.service';

@ApiTags('evaluations')
@Controller('evaluations')
export class EvaluationsController {
  constructor(
    private readonly evaluationsService: EvaluationsService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: '평가존 목록 조회' })
  @ApiOkResponse({
    description: '진행 중인 평가 게시글 목록',
    schema: {
      example: {
        items: [
          {
            evaluationId: 1,
            postId: 12,
            thumbnailUrl: 'https://images.example.com/posts/open-post.jpg',
            endsAt: '2026-03-26T12:00:00.000Z',
            hasVoted: false,
          },
        ],
        nextCursor: null,
      },
    },
  })
  async getEvaluations(
    @Query() query: GetEvaluationsQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<GetEvaluationsResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.evaluationsService.getEvaluations({
      cursor: query.cursor !== undefined ? Number(query.cursor) : undefined,
      limit: query.limit !== undefined ? Number(query.limit) : undefined,
      userId: userId!,
    });
  }
}
