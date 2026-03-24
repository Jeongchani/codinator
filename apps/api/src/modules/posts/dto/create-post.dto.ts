import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { GarmentCategory } from '@codinator/contracts';

export class CreatePostImageDto {
  @ApiProperty({
    example: 'https://images.example.com/posts/new-post.jpg',
    description: '게시글 대표 이미지 URL',
  })
  imageUrl: string;
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
