import { ApiPropertyOptional } from '@nestjs/swagger';
import type {
  GarmentCategory,
  UpdatePostOutfitItemRequest,
  UpdatePostRequest,
} from '@codinator/contracts';

export class UpdatePostOutfitItemDto implements UpdatePostOutfitItemRequest {
  @ApiPropertyOptional({
    example: 'TOP',
    description: '의류 카테고리',
    enum: ['TOP', 'BOTTOM', 'OUTER', 'SHOES', 'BAG', 'ACCESSORY', 'ETC'],
  })
  category: GarmentCategory;

  @ApiPropertyOptional({
    example: '와이드 셔츠',
    maxLength: 100,
    description: '아이템명 (최대 100자)',
  })
  itemName?: string;

  @ApiPropertyOptional({
    example: '무신사',
    maxLength: 100,
    description: '브랜드명 (최대 100자)',
  })
  brand?: string;
}

export class UpdatePostDto implements UpdatePostRequest {
  @ApiPropertyOptional({
    example: '평가 종료 후 수정된 코디 설명',
    maxLength: 500,
    description: '게시글 본문 (ENDED/CLOSED 상태에서만 수정 가능, 최대 500자)',
  })
  content?: string;

  @ApiPropertyOptional({
    type: () => [UpdatePostOutfitItemDto],
    description: '착장 아이템 목록 (OPEN/ENDED/CLOSED 모두 수정 가능, 전체 교체)',
    example: [
      {
        category: 'TOP',
        itemName: '와이드 셔츠',
        brand: '무신사',
      },
    ],
  })
  outfitItems?: UpdatePostOutfitItemDto[];
}
