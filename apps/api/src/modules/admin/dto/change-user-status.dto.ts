// V3 Batch11
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ChangeUserStatusRequest } from '@codinator/contracts';

export class ChangeUserStatusDto implements ChangeUserStatusRequest {
  @ApiProperty({
    enum: ['ACTIVE', 'SUSPENDED', 'DELETED'],
    example: 'SUSPENDED',
    description: '변경할 회원 상태. DELETED는 SUPER_ADMIN만 가능',
  })
  @IsEnum(['ACTIVE', 'SUSPENDED', 'DELETED'])
  status!: 'ACTIVE' | 'SUSPENDED' | 'DELETED';

  @ApiPropertyOptional({
    description: '변경 사유 (최대 300자)',
    example: '커뮤니티 가이드라인 위반으로 임시 정지',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
