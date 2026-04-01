import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ChangePostStatusRequest } from '@codinator/contracts';

export class ChangePostStatusDto implements ChangePostStatusRequest {
  @ApiProperty({
    description: '변경할 게시글 상태',
    enum: ['ACTIVE', 'HIDDEN', 'DELETED'],
    example: 'HIDDEN',
  })
  status!: 'ACTIVE' | 'HIDDEN' | 'DELETED';

  @ApiPropertyOptional({
    description: 'status === HIDDEN 일 때 숨김 사유 (최대 255자)',
    example: '커뮤니티 가이드라인 위반',
    maxLength: 255,
  })
  hiddenReason?: string;
}
