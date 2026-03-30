import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMeDto {
  @ApiPropertyOptional({
    example: 'new_nickname',
    description: '변경할 닉네임 (최대 30자)',
  })
  nickname?: string;

  @ApiPropertyOptional({
    example: '010-9876-5432',
    description: '변경할 전화번호. 저장 시 숫자만 정규화됨',
  })
  phoneNumber?: string;
}
