import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  GarmentCategory,
  UpdatePostOutfitItemRequest,
  UpdatePostRequest,
} from '@codinator/contracts';

// Batch5: V3 정책 — outfitItems 중심 수정. content 수정 필드 제거.

export class UpdatePostOutfitItemDto implements UpdatePostOutfitItemRequest {
  @ApiProperty({
    example: 'TOP',
    description: '의류 카테고리 (필수)',
    enum: ['TOP', 'BOTTOM', 'OUTER', 'SHOES', 'BAG', 'ACCESSORY', 'ETC'],
  })
  category!: GarmentCategory;

  @ApiPropertyOptional({
    example: '와이드 셔츠',
    maxLength: 100,
    description: '아이템명 (최대 100자)',
  })
  itemName?: string | null;

  @ApiPropertyOptional({
    example: '무신사',
    maxLength: 100,
    description: '브랜드명 (최대 100자)',
  })
  brand?: string | null;
}

export class UpdatePostDto implements UpdatePostRequest {
  @ApiProperty({
    type: () => [UpdatePostOutfitItemDto],
    description: [
      '착장 아이템 목록 (필수, 전체 교체 방식).',
      '빈 배열([]) 전송 시 전체 삭제.',
      'OPEN / ENDED / CLOSED 상태 모두 수정 가능.',
      '※ V3: content / imageAssetId / keywordIds는 이 API로 수정하지 않는다.',
    ].join(' '),
    example: [
      { category: 'TOP', itemName: '화이트 셔츠', brand: 'SPAO' },
      { category: 'BOTTOM', itemName: '와이드 슬랙스', brand: 'MUSINSA STANDARD' },
    ],
  })
  outfitItems!: UpdatePostOutfitItemDto[];
}
