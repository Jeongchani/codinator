import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMeDto {
  @ApiPropertyOptional({
    example: 'new_nickname',
    description: '변경할 닉네임 (최대 30자)',
  })
  nickname?: string;

  // phoneNumber는 V3 정책에 따라 PATCH /users/me/phone 경로로만 변경 가능
}
