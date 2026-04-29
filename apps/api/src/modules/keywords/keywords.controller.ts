import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { GetKeywordsResponse } from '@codinator/contracts';
import { KeywordsService } from './keywords.service';

@ApiTags('keywords')
@Controller('keywords')
export class KeywordsController {
  constructor(private readonly keywordsService: KeywordsService) {}

  @Get()
  @ApiOperation({ summary: '사전 정의 키워드 목록 조회' })
  @ApiOkResponse({
    description: '게시글 업로드 시 사용할 키워드 목록',
  })
  async getKeywords(): Promise<GetKeywordsResponse> {
    return this.keywordsService.getKeywords();
  }
}
