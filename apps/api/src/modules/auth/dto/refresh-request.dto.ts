import { ApiProperty } from '@nestjs/swagger';

export class RefreshRequestDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIs...',
    description: '로그인 시 발급받은 Refresh Token',
  })
  refreshToken: string;
}
