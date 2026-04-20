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
    description:
      '닉네임 / 키워드 / 게시글 본문 검색을 지원합니다. 평가완료되어 공개 가능한 게시글만 검색합니다.',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    type: String,
    description: '검색어 (1자 이상, 최대 100자)',
    example: '블랙',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['ALL', 'NICKNAME', 'KEYWORD', 'POST'],
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
  @ApiOkResponse({ description: '텍스트 검색 결과' })
  @ApiBadRequestResponse({ description: 'q/type/cursor/limit 형식이 잘못된 경우' })
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
      '',
      '**모드**',
      '- FULL_OUTFIT(기본): 전체 스타일·색감·실루엣 유사도 기반 (OUTFIT 벡터 사용)',
      '- SINGLE_ITEM: 특정 의류와 유사한 아이템이 포함된 게시글 우선 (GARMENT 벡터 사용)',
      '',
      '**필터** — 아래 중 하나 이상 지정 시 교집합 조건으로 적용됩니다.',
      '- publishedFrom/To: 게시글 공개 시점(publishedAt) 범위',
      '- minLikeRatio/maxLikeRatio: 0.0~1.0 좋아요 비율 범위',
      '- outfitCategories: 게시글 outfit 카테고리 필터',
      '- keywordCodes: 게시글에 연결된 키워드 코드 필터',
      '- feedbackTagCodes: 게시글이 받은 피드백 태그 코드 필터',
      '',
      '**검색 대상**: evaluation.status=ENDED, post.status=ACTIVE, publishedAt IS NOT NULL,',
      'hiddenAt=null, deletedAt=null, isSearchable=true 인 게시글만 포함됩니다.',
      '',
      '처음 호출 시 AI 서버에서 이미지를 분석합니다. 이미지 품질이 너무 낮으면 422를 반환합니다.',
    ].join('\n'),
  })
  @ApiBody({ type: SearchImageDto })
  @ApiOkResponse({
    description: '이미지 검색 결과 (유사도 내림차순)',
    schema: {
      example: {
        mode: 'FULL_OUTFIT',
        queryImageAssetId: 201,
        analysisRunId: 35,
        items: [
          {
            postId: 12,
            userId: 3,
            thumbnailUrl: '/uploads/posts/processed/20260401/uuid.jpg',
            content: '블랙 레더 자켓 데일리룩',
            createdAt: '2026-04-01T12:00:00.000Z',
            similarity: 0.93,
            keywords: [{ keywordId: 2, label: '데일리룩' }],
          },
        ],
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Bearer Token 누락 또는 만료' })
  @ApiBadRequestResponse({ description: 'imageAssetId 유효하지 않음 / 필터 형식 오류' })
  @ApiNotFoundResponse({ description: '검색용 이미지 자산을 찾을 수 없음 / 벡터 없음' })
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
