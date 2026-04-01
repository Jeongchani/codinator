import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type {
  CreatePostResponse,
  DeletePostResponse,
  GetPostDetailResponse,
  HidePostResponse,
  UpdatePostResponse,
} from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '게시글 작성 및 평가 시작' })
  @ApiBody({ type: CreatePostDto })
  @ApiCreatedResponse({
    description: '게시글 생성 완료',
    schema: {
      example: {
        postId: 14,
        evaluationId: 7,
        status: 'ACTIVE',
      },
    },
  })
  async createPost(
    @Body() body: CreatePostDto,
    @Headers('authorization') authorization?: string,
  ): Promise<CreatePostResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      {
        required: true,
      },
    );

    return this.postsService.createPost(userId!, body);
  }

  @Get('me/:postId')
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 게시글 상세 조회' })
  @ApiOkResponse({
    description: '작성자 본인 기준 게시글 상세 정보',
    schema: {
      example: {
        postId: 12,
        author: {
          userId: 1,
          nickname: '앨리스',
        },
        content: '봄 데일리 코디입니다.',
        status: 'ACTIVE',
        createdAt: '2026-03-20T02:00:00.000Z',
        images: [
          {
            id: 101,
            originalImageUrl:
              '/uploads/posts/originals/20260325/open-post.jpg',
            processedImageUrl:
              '/uploads/posts/processed/20260325/open-post.jpg',
            thumbnailUrl: null,
            storageKey: 'posts/originals/20260325/open-post.jpg',
            blurMethod: 'AUTO',
            aiBlurStatus: 'DONE',
            sortOrder: 0,
            isPrimary: true,
          },
        ],
        keywords: [
          {
            id: 1,
            code: 'DAILY_LOOK',
            label: '데일리룩',
            sortOrder: 0,
          },
        ],
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
        myVoteId: null,
        myVoteChoice: null,
        myFeedbackTagIds: [],
        voteSummary: {
          likeCount: 3,
          dislikeCount: 1,
          totalCount: 4,
          likeRate: 0.75,
        },
        feedbackSummary: [
          {
            tagId: 4,
            code: 'NEG_COLOR_BAD',
            label: '색 조합이 아쉬워요',
            count: 1,
            voteChoice: 'DISLIKE',
          },
        ],
      },
    },
  })
  async getMyPostDetail(
    @Param('postId', ParseIntPipe) postId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<GetPostDetailResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      {
        required: true,
      },
    );

    return this.postsService.getMyPostDetail(postId, userId!);
  }

  @Patch(':postId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '게시글 수정',
    description:
      '본인 게시글만 수정할 수 있습니다. OPEN 상태에서는 outfitItems만 수정 가능하고, ENDED/CLOSED 상태에서는 content와 outfitItems를 수정할 수 있습니다.',
  })
  @ApiParam({
    name: 'postId',
    type: Number,
    example: 12,
    description: '수정할 게시글 ID',
  })
  @ApiBody({ type: UpdatePostDto })
  @ApiOkResponse({
    description: '게시글 수정 완료',
    schema: {
      example: {
        postId: 12,
        content: '평가 종료 후 수정한 코디 설명입니다.',
        outfitItems: [
          {
            category: 'TOP',
            itemName: '화이트 셔츠',
            brand: 'SPAO',
            sortOrder: 0,
          },
          {
            category: 'BOTTOM',
            itemName: '와이드 슬랙스',
            brand: 'MUSINSA STANDARD',
            sortOrder: 1,
          },
        ],
        updatedAt: '2026-03-30T12:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      '잘못된 요청입니다. 수정할 내용이 없거나, OPEN 상태에서 content 수정을 요청한 경우입니다.',
  })
  @ApiUnauthorizedResponse({
    description: '인증이 필요합니다.',
  })
  @ApiForbiddenResponse({
    description: '본인 게시글만 수정할 수 있습니다.',
  })
  @ApiNotFoundResponse({
    description: '게시글을 찾을 수 없습니다.',
  })
  @ApiUnprocessableEntityResponse({
    description: '현재 상태의 게시글은 수정할 수 없습니다.',
  })
  async updatePost(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() body: UpdatePostDto,
    @Headers('authorization') authorization?: string,
  ): Promise<UpdatePostResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      {
        required: true,
      },
    );

    return this.postsService.updatePost(userId!, postId, body);
  }

  // ─── PATCH /posts/:postId/hide ───────────────────────────────────────────────

  @Patch(':postId/hide')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '게시글 숨기기 (작성자)',
    description:
      'V2 정책: 작성자가 게시글을 직접 숨깁니다. post.status → HIDDEN, evaluation.status → CLOSED. 공개 피드/검색에서 제외되며 본인 피드에서는 계속 조회 가능합니다.',
  })
  @ApiParam({ name: 'postId', type: Number, example: 12, description: '숨길 게시글 ID' })
  @ApiOkResponse({
    description: '게시글 숨기기 완료',
    schema: { example: { postId: 12, hidden: true } },
  })
  @ApiBadRequestResponse({ description: '이미 숨긴 게시글입니다.' })
  @ApiForbiddenResponse({ description: '본인 게시글만 숨길 수 있습니다.' })
  @ApiNotFoundResponse({ description: '게시글을 찾을 수 없습니다.' })
  async hidePost(
    @Param('postId', ParseIntPipe) postId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<HidePostResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.postsService.hidePost(userId!, postId);
  }

  // ─── DELETE /posts/:postId ────────────────────────────────────────────────────

  @Delete(':postId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '게시글 삭제 (소프트 삭제)' })
  @ApiParam({ name: 'postId', type: Number, example: 12, description: '삭제할 게시글 ID' })
  @ApiOkResponse({
    description: '게시글 삭제 완료',
    schema: { example: { success: true } },
  })
  @ApiForbiddenResponse({ description: '본인 게시글만 삭제할 수 있습니다.' })
  @ApiNotFoundResponse({ description: '게시글을 찾을 수 없습니다.' })
  async deletePost(
    @Param('postId', ParseIntPipe) postId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<DeletePostResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.postsService.deletePost(userId!, postId);
  }
}