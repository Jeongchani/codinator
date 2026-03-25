import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { GarmentCategory } from '@codinator/contracts';

export class CreatePostImageDto {
  @ApiProperty({
    example: '/uploads/posts/20260325/new-post.jpg',
    description: '게시글 대표 이미지 URL',
  })
  imageUrl: string;

  @ApiPropertyOptional({
    example: 'posts/20260325/new-post.jpg',
    description: '스토리지 내부 키',
  })
  storageKey?: string | null;

  @ApiPropertyOptional({
    example: '/uploads/posts/20260325/thumb-new-post.jpg',
    description: '썸네일 URL',
  })
  thumbnailUrl?: string | null;
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
  @ApiPropertyOptional({ example: '봄 코디 평가 부탁드립니다.', description: '게시글 본문' })
  content?: string | null;

  @ApiProperty({ type: CreatePostImageDto, description: '대표 이미지 1장' })
  image: CreatePostImageDto;

  @ApiPropertyOptional({
    type: [CreatePostOutfitItemDto],
    description: '착용 아이템 목록',
  })
  outfitItems?: CreatePostOutfitItemDto[];
}
