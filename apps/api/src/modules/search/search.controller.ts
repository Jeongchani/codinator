import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { ImageSearchResponse, SearchResponse } from '@codinator/contracts';
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

  @Post('image')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '랭킹존 AI 이미지 검색',
    description:
      'uploads/search-image 업로드 후 받은 imageAssetId를 기준으로 공개 가능한 랭킹존 게시글만 유사도 검색합니다.',
  })
  @ApiBody({ type: SearchImageDto })
  @ApiOkResponse({ description: '이미지 검색 결과' })
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
