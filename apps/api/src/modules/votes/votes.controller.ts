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
  CreateVoteResponse,
  GetTagsResponse,
} from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { CreateFeedbackBodyDto } from './dto/create-feedback-body.dto';
import { CreateVoteBodyDto } from './dto/create-vote-body.dto';
import { GetTagsQueryDto } from './dto/get-tags-query.dto';
import { VotesService } from './votes.service';

@ApiTags('votes')
@Controller('evaluations')
export class VotesController {
  constructor(
    private readonly votesService: VotesService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  @Get('tags')
  @ApiBearerAuth()
  @ApiOperation({ summary: '투표 타입별 피드백 태그 조회' })
  @ApiQuery({ name: 'voteChoice', required: true, enum: ['LIKE', 'DISLIKE'] })
  @ApiOkResponse({
    description: '좋아요/싫어요에 맞는 태그 목록',
  })
  async getTags(
    @Query() query: GetTagsQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<GetTagsResponse> {
    this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.votesService.getTags(query.voteChoice);
  }

  @Post('posts/:postId/votes')
  @ApiBearerAuth()
  @ApiOperation({ summary: '평가 게시글 투표' })
  @ApiBody({ type: CreateVoteBodyDto })
  @ApiOkResponse({
    description: '투표 완료 후 voteId와 현재 집계를 반환',
  })
  async createVote(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() body: CreateVoteBodyDto,
    @Headers('authorization') authorization?: string,
  ): Promise<CreateVoteResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.votesService.createVote(postId, userId!, body.choice);
  }

  @Post('votes/:voteId/feedback')
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 투표에 피드백 태그 1개 선택' })
  @ApiBody({ type: CreateFeedbackBodyDto })
  @ApiOkResponse({
    description: '피드백 태그 선택 결과',
  })
  async createFeedback(
    @Param('voteId', ParseIntPipe) voteId: number,
    @Body() body: CreateFeedbackBodyDto,
    @Headers('authorization') authorization?: string,
  ): Promise<CreateFeedbackResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.votesService.createFeedback(voteId, userId!, body.tagId);
  }
}
