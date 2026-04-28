import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common'; // V3 Batch8: Delete, HttpCode, HttpStatus, Param, ParseIntPipe 추가
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { DeleteSearchHistoryResponse, ImageSearchResponse, SearchResponse } from '@codinator/contracts'; // V3 Batch8
import { AuthTokenService } from '../auth/auth-token.service';
import { SearchImageDto } from './dto/search-image.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary: '랭킹존 텍스트 검색',
    description: [
      '닉네임 / 키워드 / 게시글 본문 / 착용 아이템 검색을 지원합니다.',
      '평가완료되어 공개 가능한 게시글만 검색합니다.',
      '',
      '**검색 타입 (type)**',
      '- ALL: 닉네임 + 게시글 전체(searchText + keyword label) 통합 검색 (기본값)',
      '- NICKNAME: 닉네임 검색 (유저 반환)',
      '- KEYWORD: 키워드 라벨 기반 검색 (게시글 반환)',
      '- POST: 게시글 본문·닉네임·착용정보 통합 searchText 검색 (게시글 반환)',
      '- OUTFIT_ITEM: 착용 아이템 상품명(itemName) 중심 검색 (게시글 반환)',
      '- OUTFIT_BRAND: 착용 아이템 브랜드(brand) 중심 검색 (게시글 반환)',
      '',
      '**고급 필터** (NICKNAME 제외 모든 타입에 적용)',
      '- periodFrom/periodTo: 게시글 공개 시점(publishedAt) 범위 (ISO 8601)',
      '- likeRatioMin: 0.0~1.0 최소 좋아요 비율',
      '- outfitCategories: 착용 아이템 카테고리 필터 (반복 파라미터)',
      '- keywordIds: 키워드 ID 배열 필터 (반복 파라미터)',
      '- feedbackLikeTagIds: 좋아요 피드백 태그 ID 배열 (반복 파라미터)',
      '- feedbackDislikeTagIds: 싫어요 피드백 태그 ID 배열 (반복 파라미터)',
      '',
      '**검색 대상**: evaluation.status=ENDED, post.status=ACTIVE,',
      'publishedAt IS NOT NULL, hiddenAt=null, deletedAt=null, isSearchable=true 인 게시글만 포함됩니다.',
    ].join('\n'), // TextSearchAdvanced
  })
  @ApiQuery({
    name: 'q',
    required: true,
    type: String,
    description: '검색어 (1자 이상, 최대 100자)',
    example: '블랙',
  })
  // TextSearchAdvanced: OUTFIT_ITEM / OUTFIT_BRAND 추가
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['ALL', 'NICKNAME', 'KEYWORD', 'POST', 'OUTFIT_ITEM', 'OUTFIT_BRAND'],
    description: '검색 타입. 생략 또는 ALL이면 통합 검색',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: Number,
    description: '단일 타입 검색용 커서. ALL 검색은 미지원',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '페이지 크기 (기본 20, 최대 50)',
  })
  // TextSearchAdvanced: 고급 필터 파라미터 문서화
  @ApiQuery({
    name: 'periodFrom',
    required: false,
    type: String,
    description: 'publishedAt 시작 시점 이상 (ISO 8601). 예: 2026-04-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'periodTo',
    required: false,
    type: String,
    description: 'publishedAt 종료 시점 이하 (ISO 8601). 예: 2026-04-30T23:59:59.999Z',
  })
  @ApiQuery({
    name: 'likeRatioMin',
    required: false,
    type: Number,
    description: '최소 좋아요 비율 (0.0 ~ 1.0)',
  })
  @ApiQuery({
    name: 'outfitCategories',
    required: false,
    isArray: true,
    type: String,
    description: '착용 아이템 카테고리 필터. 반복 파라미터: outfitCategories=TOP&outfitCategories=OUTER',
  })
  @ApiQuery({
    name: 'keywordIds',
    required: false,
    isArray: true,
    type: Number,
    description: '키워드 ID 필터. 반복 파라미터: keywordIds=1&keywordIds=2',
  })
  @ApiQuery({
    name: 'feedbackLikeTagIds',
    required: false,
    isArray: true,
    type: Number,
    description: '좋아요 피드백 태그 ID 필터. 반복 파라미터',
  })
  @ApiQuery({
    name: 'feedbackDislikeTagIds',
    required: false,
    isArray: true,
    type: Number,
    description: '싫어요 피드백 태그 ID 필터. 반복 파라미터',
  })
  @ApiOkResponse({ description: '텍스트 검색 결과' })
  @ApiBadRequestResponse({ description: 'q/type/cursor/limit/필터 형식이 잘못된 경우' })
  @ApiUnauthorizedResponse({ description: 'Bearer Token 누락 또는 만료' })
  async search(
    @Query() query: SearchQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<SearchResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.searchService.search({
      userId: userId!,
      q: query.q,
      type: query.type,
      cursor: query.cursor !== undefined ? Number(query.cursor) : undefined,
      limit: query.limit !== undefined ? Number(query.limit) : undefined,
      // TextSearchAdvanced: 고급 필터 전달
      periodFrom: query.periodFrom,
      periodTo: query.periodTo,
      likeRatioMin: query.likeRatioMin !== undefined ? Number(query.likeRatioMin) : undefined,
      outfitCategories: query.outfitCategories,
      keywordIds: query.keywordIds,
      feedbackLikeTagIds: query.feedbackLikeTagIds,
      feedbackDislikeTagIds: query.feedbackDislikeTagIds,
    });
  }

  // ── DELETE /search/histories/:historyId ──────────────────────────────────
  // V3 Batch8: 최근 검색 기록 삭제

  @Delete('histories/:historyId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '검색 기록 삭제 (V3)',
    description: [
      '본인의 검색 기록만 삭제할 수 있습니다.',
      '존재하지 않는 기록은 404, 타인 기록은 403을 반환합니다.',
      'soft delete 없이 즉시 삭제합니다.',
    ].join(' '),
  })
  @ApiParam({ name: 'historyId', type: Number, description: '삭제할 검색 기록 ID' })
  @ApiOkResponse({ description: '검색 기록 삭제 성공' })
  @ApiNotFoundResponse({ description: '검색 기록을 찾을 수 없음' })
  @ApiForbiddenResponse({ description: '본인 기록이 아닌 경우' })
  @ApiUnauthorizedResponse({ description: 'Bearer Token 누락 또는 만료' })
  async deleteSearchHistory(
    @Param('historyId', ParseIntPipe) historyId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<DeleteSearchHistoryResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.searchService.deleteSearchHistory(userId!, historyId);
  }

  // ── POST /search/image ──────────────────────────────────────────────────── V3 Batch9

  @Post('image')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '랭킹존 AI 이미지 검색 (V3)',
    description: [
      'POST /uploads/search-image 로 업로드한 이미지를 기준으로',
      '공개 가능한 랭킹존 게시글만 vector 유사도 기반으로 검색합니다.',
      '유사도 0.3 미만 결과는 항상 제외됩니다.',
      '',
      '**모드 (mode — 선택값)**',
      '- 생략 시: AI 분석 결과(의류 수·면적·얼굴 감지 여부)를 기반으로 자동 판별합니다.',
      '  · 얼굴 없음 + 가장 큰 의류 areaRatio ≥ 0.6 → SINGLE_ITEM',
      '  · 복수 의류(≥2) 또는 얼굴 감지(≥1) → FULL_OUTFIT',
      '  · 단일 의류 → SINGLE_ITEM, 의류 없음 → FULL_OUTFIT(기본)',
      '  · 1차 결과 0건(또는 전부 유사도 0.3 미만)이면 반대 mode로 1회 자동 fallback.',
      '- FULL_OUTFIT: 전체 착장 스타일·색감·실루엣 유사도 (OUTFIT 벡터)',
      '- SINGLE_ITEM: 단일 의류 단품 유사도 (GARMENT 벡터)',
      '',
      '**resolvedMode**: 응답에 최종 사용된 mode가 반환됩니다.',
      '',
      '**카테고리 필터** (결과 게시글 outfit category 기준)',
      '- outfitCategories: 허용 값 — TOP / BOTTOM / OUTER / SHOES / BAG / ACCESSORY / ETC',
      '  한국어(상의/하의/아우터/신발/가방/악세사리/기타)도 허용. DRESS·원피스는 400 오류.',
      '- garmentCategory: [하위 호환] 단일 값 지정 시 outfitCategories로 병합 처리.',
      '  ※ query 이미지 벡터 선택에는 영향 없음 — 결과 게시글 필터 전용.',
      '',
      '**추가 필터** — 지정 시 교집합 조건으로 적용됩니다.',
      '- periodFrom/periodTo: 게시글 공개 시점(publishedAt) 범위 (ISO 8601)',
      '- likeRatioMin: 0.0~1.0 최소 좋아요 비율',
      '- keywordIds: 키워드 ID 배열',
      '- feedbackLikeTagIds: 좋아요 피드백 태그 ID 배열 (voteChoice=LIKE)',
      '- feedbackDislikeTagIds: 싫어요 피드백 태그 ID 배열 (voteChoice=DISLIKE)',
      '',
      '**검색 대상**: evaluation.status=ENDED, post.status=ACTIVE, publishedAt IS NOT NULL,',
      'hiddenAt=null, deletedAt=null, isSearchable=true 인 게시글만 포함됩니다.',
      '',
      '처음 호출 시 AI 서버에서 이미지를 분석합니다.',
      '이미지 품질이 낮거나 의류/전신이 명확히 보이지 않으면 422를 반환합니다.',
    ].join('\n'),
  })
  @ApiBody({ type: SearchImageDto })
  @ApiOkResponse({
    description: '이미지 검색 결과 (유사도 내림차순, offset 기반 페이지네이션)',
    schema: {
      properties: {
        resolvedMode: {
          type: 'string',
          enum: ['FULL_OUTFIT', 'SINGLE_ITEM'],
          description: '최종 사용된 검색 모드. mode를 명시했으면 그 값, 생략했으면 자동 판별된 값',
          example: 'FULL_OUTFIT',
        },
        queryImageAssetId: {
          type: 'integer',
          description: '검색에 사용된 이미지 자산 ID',
          example: 201,
        },
        analysisRunId: {
          type: 'integer',
          description: 'AI 분석 run ID',
          example: 35,
        },
        items: {
          type: 'array',
          description: '유사도 내림차순 정렬된 게시글 목록 (similarity ≥ 0.3)',
          items: {
            type: 'object',
            properties: {
              postId: { type: 'integer', example: 12 },
              userId: { type: 'integer', example: 3 },
              thumbnailUrl: {
                type: 'string',
                nullable: true,
                example: '/uploads/posts/processed/20260401/uuid.jpg',
              },
              content: { type: 'string', example: '블랙 레더 자켓 데일리룩' },
              createdAt: {
                type: 'string',
                format: 'date-time',
                example: '2026-04-01T12:00:00.000Z',
              },
              similarity: {
                type: 'number',
                description: 'cosine similarity (0~1). 항상 0.3 이상',
                example: 0.93,
              },
              keywords: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    keywordId: { type: 'integer', example: 2 },
                    label: { type: 'string', example: '데일리룩' },
                  },
                },
              },
            },
          },
        },
        nextCursor: {
          type: 'integer',
          nullable: true,
          description: '다음 페이지 offset 커서. 다음 페이지 없으면 null',
          example: 20,
        },
        hasMore: {
          type: 'boolean',
          description: '다음 페이지 존재 여부',
          example: true,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Bearer Token 누락 또는 만료' })
  @ApiBadRequestResponse({
    description: [
      'imageAssetId 유효하지 않음',
      '/ outfitCategories·garmentCategory에 DRESS·원피스 등 지원하지 않는 카테고리 포함',
      '/ keywordIds·feedbackTagIds 존재하지 않음 또는 voteChoice 불일치',
      '/ periodFrom > periodTo',
      '/ likeRatioMin 범위 초과',
    ].join(' '),
  })
  @ApiNotFoundResponse({ description: '검색용 이미지 자산을 찾을 수 없음 (소유권 불일치 포함)' })
  @ApiUnprocessableEntityResponse({
    description: '이미지 품질이 낮거나 의류/전신이 명확히 보이지 않아 AI 분석에 실패한 경우 (422)',
  })
  async searchImage(
    @Body() body: SearchImageDto,
    @Headers('authorization') authorization?: string,
  ): Promise<ImageSearchResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.searchService.searchImage(userId!, body);
  }
}
