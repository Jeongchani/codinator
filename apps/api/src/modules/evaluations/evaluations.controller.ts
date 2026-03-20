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
  GetEvaluationsResponse,
  GetPostDetailResponse,
  GetTagsResponse,
} from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { CreateFeedbackBodyDto } from './dto/create-feedback-body.dto';
import { CreateVoteBodyDto } from './dto/create-vote-body.dto';
import { GetEvaluationsQueryDto } from './dto/get-evaluations-query.dto';
import { GetTagsQueryDto } from './dto/get-tags-query.dto';
import { EvaluationsService } from './evaluations.service';

@ApiTags('evaluations')
@Controller('evaluations')
export class EvaluationsController {
  constructor(
    private readonly evaluationsService: EvaluationsService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  @Get()
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
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization);

    return this.evaluationsService.getEvaluations({
      cursor: query.cursor !== undefined ? Number(query.cursor) : undefined,
      limit: query.limit !== undefined ? Number(query.limit) : undefined,
      userId,
    });
  }

  @Get('posts/:postId')
  @ApiOperation({ summary: '평가 게시글 상세 조회' })
  @ApiOkResponse({
    description: '평가 게시글 상세 정보',
    schema: {
      example: {
        postId: 12,
        authorId: 1,
        content: '봄 데일리 코디 평가 부탁드립니다.',
        createdAt: '2026-03-20T02:00:00.000Z',
        image: {
          id: 101,
          imageUrl: 'https://images.example.com/posts/open-post.jpg',
        },
        outfitItems: [
          {
            id: 1,
            category: 'TOP',
            itemName: '화이트 셔츠',
            brand: 'SPAO',
          },
        ],
        evaluation: {
          id: 5,
          status: 'OPEN',
          endsAt: '2026-03-26T12:00:00.000Z',
        },
        hasVoted: false,
        canVote: true,
        voteSummary: {
          likeCount: 2,
          dislikeCount: 1,
          totalCount: 3,
          likeRate: 0.6667,
        },
        feedbackSummary: [
          {
            tagId: 4,
            code: 'NEG_COLOR_BAD',
            label: '색 조합이 아쉬워요',
            count: 1,
          },
        ],
      },
    },
  })
  async getPostDetail(
    @Param('postId', ParseIntPipe) postId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<GetPostDetailResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization);
    return this.evaluationsService.getPostDetail(postId, userId);
  }

  @Get('tags')
  @ApiOperation({ summary: '투표 타입별 피드백 태그 조회' })
  @ApiQuery({ name: 'voteChoice', required: true, enum: ['LIKE', 'DISLIKE'] })
  @ApiOkResponse({
    description: '좋아요/싫어요에 맞는 태그 목록',
    schema: {
      example: {
        items: [
          {
            id: 3,
            code: 'NEG_SIZE_BAD',
            label: '핏/사이즈가 아쉬워요',
            polarity: 'NEGATIVE',
            voteChoice: 'DISLIKE',
            isActive: true,
          },
        ],
      },
    },
  })
  async getTags(@Query() query: GetTagsQueryDto): Promise<GetTagsResponse> {
    return this.evaluationsService.getTags(query.voteChoice);
  }

  @Post('posts/:postId/votes')
  @ApiBearerAuth()
  @ApiOperation({ summary: '평가 게시글 투표' })
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
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.evaluationsService.createVote(postId, userId!, body.choice);
  }

  @Post('votes/:voteId/feedback')
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 투표에 피드백 태그 1개 선택' })
  @ApiBody({ type: CreateFeedbackBodyDto })
  @ApiOkResponse({
    description: '피드백 태그 선택 결과',
    schema: {
      example: {
        postId: 12,
        selectedTagId: 3,
      },
    },
  })
  async createFeedback(
    @Param('voteId', ParseIntPipe) voteId: number,
    @Body() body: CreateFeedbackBodyDto,
    @Headers('authorization') authorization?: string,
  ): Promise<CreateFeedbackResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.evaluationsService.createFeedback(voteId, userId!, body.tagId);
  }
}
