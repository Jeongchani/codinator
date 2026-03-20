import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({ example: 1, description: '유저 ID' })
  userId: number;

  @ApiProperty({ example: 'test@example.com', description: '로그인한 이메일' })
  email: string;

  @ApiProperty({ example: 'jwt-token-string', description: '발급된 JWT Access Token' })
  accessToken: string;
}
