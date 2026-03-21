import { ApiProperty } from '@nestjs/swagger';

export class LogoutRequestDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIs...',
    description: '무효화할 Refresh Token',
  })
  refreshToken: string;
}
