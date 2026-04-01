import { Controller, Get, Headers, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { SearchResponse } from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
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
    summary: 'V2 통합 검색',
    description:
      '닉네임 / 키워드 / 게시글 본문 검색을 지원합니다. OPEN 평가 게시글은 익명성 보호를 위해 검색 결과에서 제외합니다.',
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
  @ApiOkResponse({
    description: '검색 결과',
    schema: {
      example: {
        type: 'ALL',
        users: [{ userId: 7, nickname: '블랙러버' }],
        posts: [
          {
            postId: 42,
            thumbnailUrl: '/uploads/posts/processed/20260325/post-42.jpg',
            content: '블랙 자켓 코디 어떤가요?',
            createdAt: '2026-03-25T10:00:00.000Z',
          },
        ],
        nextCursor: null,
        hasMore: false,
      },
    },
  })
  @ApiBadRequestResponse({ description: 'q/type/cursor/limit 형식이 잘못된 경우' })
  @ApiUnauthorizedResponse({ description: 'Bearer Token 누락 또는 만료' })
  async search(
    @Query() query: SearchQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<SearchResponse> {
    this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.searchService.search({
      q: query.q,
      type: query.type,
      cursor: query.cursor !== undefined ? Number(query.cursor) : undefined,
      limit: query.limit !== undefined ? Number(query.limit) : undefined,
    });
  }
}
