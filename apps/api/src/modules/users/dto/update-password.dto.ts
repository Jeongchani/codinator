import { ApiProperty } from '@nestjs/swagger';

export class UpdatePasswordDto {
  @ApiProperty({
    example: 'current1234',
    description: '현재 비밀번호',
  })
  currentPassword: string;

  @ApiProperty({
    example: 'newPass5678',
    description: '새 비밀번호',
  })
  newPassword: string;
}
