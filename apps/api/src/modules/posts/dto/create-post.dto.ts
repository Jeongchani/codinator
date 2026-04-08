import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AiBlurStatus, BlurMethod, GarmentCategory } from '@codinator/contracts';

export class CreatePostImageDto {
  @ApiProperty({
    example: '/uploads/posts/originals/20260325/post-original.jpg',
    description: '원본 이미지 URL',
  })
  originalImageUrl: string;

  @ApiPropertyOptional({
    example: '/uploads/posts/processed/20260325/post-processed.jpg',
    description: '얼굴 블러 등 후처리된 이미지 URL',
  })
  processedImageUrl?: string | null;

  @ApiPropertyOptional({
    example: '/uploads/posts/thumbnails/20260325/post-thumb.jpg',
    description: '썸네일 이미지 URL',
  })
  thumbnailUrl?: string | null;

  @ApiPropertyOptional({
    example: 'posts/originals/20260325/post-original.jpg',
    description: '스토리지 내부 키',
  })
  storageKey?: string | null;

  @ApiPropertyOptional({
    example: 'AUTO',
    enum: ['NONE', 'AUTO', 'MANUAL'],
    description: '얼굴 블러 처리 방식',
  })
  blurMethod?: BlurMethod;

  @ApiPropertyOptional({
    example: 'DONE',
    enum: ['NONE', 'PENDING', 'PROCESSING', 'DONE', 'FAILED'],
    description: 'AI 블러 처리 상태',
  })
  aiBlurStatus?: AiBlurStatus;
}

export class CreatePostOutfitItemDto {
  @ApiProperty({
    example: 'TOP',
    enum: ['TOP', 'BOTTOM', 'OUTER', 'SHOES', 'BAG', 'ACCESSORY', 'ETC'],
    description: '의류 카테고리',
  })
  category: GarmentCategory;

  @ApiPropertyOptional({ example: '화이트 셔츠', description: '아이템명' })
  itemName?: string | null;

  @ApiPropertyOptional({ example: 'SPAO', description: '브랜드명' })
  brand?: string | null;
}

export class CreatePostDto {
  @ApiProperty({ example: '봄 코디 평가 부탁드립니다.', description: '게시글 본문 (필수, 최대 500자)' })
  content: string;

  @ApiProperty({ type: CreatePostImageDto, description: 'V2 이미지 구조 1장' })
  image: CreatePostImageDto;

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
