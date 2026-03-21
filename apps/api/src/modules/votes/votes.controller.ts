import {
  Body,
  Controller,
  Headers,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { CreateVoteResponse } from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { CreateVoteBodyDto } from './dto/create-vote-body.dto';
import { VotesService } from './votes.service';

@ApiTags('votes')
@Controller()
export class VotesController {
  constructor(
    private readonly votesService: VotesService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  @Post('posts/:postId/votes')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '평가 게시글 투표',
    description:
      '게시글에 좋아요/싫어요 투표를 합니다. ' +
      '1인 1회만 가능하며, 자기 게시글에는 투표 불가합니다. ' +
      '투표 후 현재 집계 결과가 반환됩니다.',
  })
  @ApiBody({ type: CreateVoteBodyDto })
  @ApiOkResponse({
    description: '투표 완료 후 현재 집계 반환',
    schema: {
      example: {
        postId: 12,
        myVote: 'LIKE',
        summary: {
          likeCount: 3,
          dislikeCount: 1,
          totalCount: 4,
          likeRate: 0.75,
        },
      },
    },
  })
  async createVote(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() body: CreateVoteBodyDto,
    @Headers('authorization') authorization?: string,
  ): Promise<CreateVoteResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );

    return this.votesService.createVote(postId, userId!, body.choice);
  }
}
