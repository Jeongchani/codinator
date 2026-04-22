import { Controller, Get, Headers, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { GetSearchHistoriesResponse } from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { GetSearchHistoriesQueryDto } from './dto/get-search-histories-query.dto';
import { SearchService } from './search.service';

/**
 * [V3 Batch8] 최근 검색 기록 조회 컨트롤러
 *
 * URL prefix: /users (global prefix: api/v3 → api/v3/users/me/search-histories)
 * ApiTags: 'search' — Swagger 검색 섹션에 배치
 */
@ApiTags('search')
@Controller('users')
export class UserSearchHistoryController {
  constructor(
    private readonly searchService: SearchService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  // ── GET /users/me/search-histories ───────────────────────────────────────

  @Get('me/search-histories')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '최근 검색 기록 조회 (V3)',
    description: [
      '본인의 최근 검색 기록(TEXT / IMAGE)을 조회합니다.',
      'searchType 필터로 TEXT 또는 IMAGE 기록만 볼 수 있습니다.',
      'TEXT 기록은 queryText를 포함하고, IMAGE 기록은 imageAssetId / imageSearchMode를 포함합니다.',
      '커서 기반 페이지네이션 (historyId DESC).',
    ].join(' '),
  })
  @ApiQuery({
    name: 'searchType',
    required: false,
    enum: ['TEXT', 'IMAGE'],
    description: '검색 타입 필터. 생략 시 TEXT/IMAGE 모두 반환',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: Number,
    description: '직전 페이지 마지막 historyId (커서)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '페이지 크기 (기본 20, 최대 50)',
  })
  @ApiOkResponse({
    description: '최근 검색 기록 목록',
    schema: {
      example: {
        items: [
          {
            historyId: 15,
            searchType: 'TEXT',
            queryText: '블랙 레더 자켓',
            imageAssetId: null,
            imageSearchMode: null,
            resultCount: 8,
            createdAt: '2026-04-19T11:30:00.000Z',
          },
          {
            historyId: 14,
            searchType: 'IMAGE',
            queryText: null,
            imageAssetId: 102,
            imageSearchMode: 'FULL_OUTFIT',
            resultCount: 5,
            createdAt: '2026-04-19T10:00:00.000Z',
          },
        ],
        nextCursor: 14,
        hasMore: true,
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Bearer Token 누락 또는 만료' })
  async getMySearchHistories(
    @Query() query: GetSearchHistoriesQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<GetSearchHistoriesResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.searchService.getMySearchHistories({
      userId: userId!,
      searchType: query.searchType,
      cursor: query.cursor !== undefined ? Number(query.cursor) : undefined,
      limit: query.limit !== undefined ? Number(query.limit) : undefined,
    });
  }
}
