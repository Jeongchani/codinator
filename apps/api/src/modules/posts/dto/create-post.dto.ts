import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { GarmentCategory } from '@codinator/contracts';

export class CreatePostOutfitItemDto {
  @ApiProperty({
    example: 'TOP',
    enum: ['TOP', 'BOTTOM', 'OUTER', 'SHOES', 'BAG', 'ACCESSORY', 'ETC'],
    description: '의류 카테고리',
  })
  category!: GarmentCategory;

  @ApiPropertyOptional({ example: '화이트 셔츠', description: '아이템명' })
  itemName?: string | null;

  @ApiPropertyOptional({ example: 'SPAO', description: '브랜드명' })
  brand?: string | null;
}

export class CreatePostDto {
  @ApiProperty({ example: '봄 코디 평가 부탁드립니다.', description: '게시글 본문 (필수, 최대 500자)' })
  content!: string;

  @ApiProperty({
    example: 101,
    description: '업로드 단계에서 생성된 게시글 이미지 asset ID. 게시글 생성은 이 값만 사용한다.',
  })
  imageAssetId!: number;

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 3],
    description: '사전 정의 키워드 ID 목록',
  })
  keywordIds?: number[];

  @ApiPropertyOptional({
    type: [CreatePostOutfitItemDto],
    description: '착용 아이템 목록',
  })
  outfitItems?: CreatePostOutfitItemDto[];
}
