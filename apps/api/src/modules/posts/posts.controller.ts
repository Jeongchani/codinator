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
  UnhidePostResponse,
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

  // ─── POST /posts ──────────────────────────────────────────────────────────────

  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: '게시글 작성 및 평가 시작 (V3)',
    description: [
      'imageAssetId(V3 우선 경로) 또는 image 객체(V2 compat)로 이미지를 연결합니다.',
      '게시글 생성 시 evaluation이 함께 생성되며 7일 후 ENDED 전환됩니다.',
      'POST_RESTRICTION 제재 대상 사용자는 작성할 수 없습니다.',
    ].join(' '),
  })
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
  @ApiBadRequestResponse({
    description: 'content 누락 / imageAssetId 유효하지 않음 / keywordIds 4개 이상 / image 정보 누락',
  })
  @ApiForbiddenResponse({
    description: 'POST_RESTRICTION 제재 중인 사용자',
  })
  async createPost(
    @Body() body: CreatePostDto,
    @Headers('authorization') authorization?: string,
  ): Promise<CreatePostResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );

    return this.postsService.createPost(userId!, body);
  }

  // ─── GET /posts/me/:postId ────────────────────────────────────────────────────

  @Get('me/:postId')
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 게시글 상세 조회' })
  @ApiParam({ name: 'postId', type: Number, example: 12 })
  @ApiOkResponse({
    description: '작성자 본인 기준 게시글 상세 정보',
    schema: {
      example: {
        postId: 12,
        author: { userId: 1, nickname: '앨리스' },
        content: '봄 데일리 코디입니다.',
        status: 'ACTIVE',
        createdAt: '2026-03-20T02:00:00.000Z',
        images: [
          {
            id: 101,
            originalImageUrl: '/uploads/posts/originals/20260325/open-post.jpg',
            processedImageUrl: '/uploads/posts/processed/20260325/open-post.jpg',
            thumbnailUrl: null,
            storageKey: 'posts/originals/20260325/open-post.jpg',
            blurMethod: 'AUTO',
            aiBlurStatus: 'DONE',
            sortOrder: 0,
            isPrimary: true,
          },
        ],
        keywords: [{ id: 1, code: 'DAILY_LOOK', label: '데일리룩', sortOrder: 0 }],
        outfitItems: [{ id: 1, category: 'TOP', itemName: '화이트 셔츠', brand: 'SPAO' }],
        evaluation: { id: 5, status: 'OPEN', endsAt: '2026-03-26T12:00:00.000Z' },
        myVoteId: null,
        myVoteChoice: null,
        myFeedbackTagIds: [],
        voteSummary: { likeCount: 3, dislikeCount: 1, totalCount: 4, likeRate: 0.75 },
        feedbackSummary: [
          { tagId: 4, code: 'NEG_COLOR_BAD', label: '색 조합이 아쉬워요', count: 1, voteChoice: 'DISLIKE' },
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
      { required: true },
    );

    return this.postsService.getMyPostDetail(postId, userId!);
  }

  // ─── PATCH /posts/:postId ─────────────────────────────────────────────────────

  @Patch(':postId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '게시글 수정 (V3)',
    description: [
      'V3 정책: 일반 사용자 수정 범위는 outfitItems만.',
      'content / imageAssetId / keywordIds는 이 API로 수정하지 않는다.',
      'OPEN / ENDED / CLOSED 상태 모두 outfitItems 수정 가능.',
      'HIDDEN / DELETED 상태는 수정 불가.',
      'POST_RESTRICTION 제재 대상 사용자는 수정할 수 없습니다.',
      'outfitItems는 전체 교체 방식이며 빈 배열([]) 전송 시 전체 삭제됩니다.',
    ].join(' '),
  })
  @ApiParam({ name: 'postId', type: Number, example: 12 })
  @ApiBody({ type: UpdatePostDto })
  @ApiOkResponse({
    description: '게시글 수정 완료',
    schema: {
      example: {
        postId: 12,
        outfitItems: [
          { category: 'TOP', itemName: '화이트 셔츠', brand: 'SPAO', sortOrder: 0 },
          { category: 'BOTTOM', itemName: '와이드 슬랙스', brand: 'MUSINSA STANDARD', sortOrder: 1 },
        ],
        updatedAt: '2026-03-30T12:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'outfitItems 누락' })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  @ApiForbiddenResponse({ description: '본인 게시글 아님 / POST_RESTRICTION 제재 중' })
  @ApiNotFoundResponse({ description: '게시글을 찾을 수 없습니다.' })
  @ApiUnprocessableEntityResponse({ description: 'HIDDEN 상태의 게시글은 수정 불가' })
  async updatePost(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() body: UpdatePostDto,
    @Headers('authorization') authorization?: string,
  ): Promise<UpdatePostResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );

    return this.postsService.updatePost(userId!, postId, body);
  }

  // ─── PATCH /posts/:postId/hide ────────────────────────────────────────────────

  @Patch(':postId/hide')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '게시글 숨기기 (작성자, V3)',
    description: [
      '작성자가 게시글을 직접 숨깁니다.',
      '',
      '숨김 가능 조건 (V3):',
      '① post.status === ACTIVE',
      '② evaluation.status === ENDED — 평가 완료된 게시글만 허용',
      '  ※ rankingDetails 등재 여부와 무관하게 평가 완료 즉시 숨김 가능',
      '',
      '처리 결과:',
      '- post.status → HIDDEN (타인 피드 / 공개 상세 / 검색 / 랭킹존에서 제외)',
      '- hiddenAt, hiddenById(작성자 ID), hiddenReason("USER_HIDE") 기록',
      '- evaluation.status → 변경하지 않음 (ENDED 유지)',
      '- 본인 피드에서는 계속 조회 가능',
    ].join('\n'),
  })
  @ApiParam({ name: 'postId', type: Number, example: 12 })
  @ApiOkResponse({
    description: '게시글 숨기기 완료',
    schema: { example: { postId: 12, status: 'HIDDEN', hiddenAt: '2026-04-01T10:00:00.000Z' } },
  })
  @ApiBadRequestResponse({
    description: '이미 HIDDEN / ACTIVE 아닌 상태 / 평가 미완료(ENDED 아님)',
  })
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

  // ─── PATCH /posts/:postId/unhide ──────────────────────────────────────────────

  @Patch(':postId/unhide')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '게시글 숨김 취소 (작성자, V3)',
    description: [
      '작성자가 직접 숨긴 게시글을 복구합니다.',
      '',
      '숨김 취소 가능 조건 (V3):',
      '① post.status === HIDDEN',
      '② 작성자 직접 숨긴 게시글만 (hiddenById === authorId 또는 null)',
      '  ※ 관리자에 의해 숨겨진 게시글은 이 API로 복구할 수 없음',
      '',
      '처리 결과:',
      '- post.status → ACTIVE',
      '- hiddenAt, hiddenById, hiddenReason → null',
      '- 공개 조건(ENDED + ACTIVE + publishedAt) 만족 시 타인 피드/검색에 다시 노출',
    ].join('\n'),
  })
  @ApiParam({ name: 'postId', type: Number, example: 12 })
  @ApiOkResponse({
    description: '게시글 숨김 취소 완료',
    schema: { example: { postId: 12, status: 'ACTIVE', updatedAt: '2026-04-01T12:00:00.000Z' } },
  })
  @ApiBadRequestResponse({ description: '숨김 상태가 아닌 게시글' })
  @ApiForbiddenResponse({ description: '본인 게시글 아님 / 관리자 숨김은 복구 불가' })
  @ApiNotFoundResponse({ description: '게시글을 찾을 수 없습니다.' })
  async unhidePost(
    @Param('postId', ParseIntPipe) postId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<UnhidePostResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.postsService.unhidePost(userId!, postId);
  }

  // ─── DELETE /posts/:postId ────────────────────────────────────────────────────

  @Delete(':postId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '게시글 삭제 (소프트 삭제, V3)',
    description: [
      '소프트 삭제 처리. posts.status = DELETED, deletedAt 기록.',
      '삭제된 게시글은 검색 / 랭킹 / 타인 피드 / 공개 상세에서 제외됩니다.',
      'post_search_index.isSearchable = false 처리.',
    ].join(' '),
  })
  @ApiParam({ name: 'postId', type: Number, example: 12 })
  @ApiOkResponse({
    description: '게시글 삭제 완료',
    schema: { example: { postId: 12, status: 'DELETED', deletedAt: '2026-04-01T10:00:00.000Z' } },
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
