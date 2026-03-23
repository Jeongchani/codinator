import { ApiProperty } from '@nestjs/swagger';

class LoginUserDto {
  @ApiProperty({ example: 1, description: '유저 ID' })
  id: number;

  @ApiProperty({ example: 'test@example.com', description: '로그인한 이메일' })
  email: string;

  @ApiProperty({ example: 'codinator_jc', description: '로그인한 닉네임' })
  nickname: string;
}

export class LoginResponseDto {
  @ApiProperty({ type: LoginUserDto, description: '로그인 사용자 정보' })
  user: LoginUserDto;

  @ApiProperty({ example: 'jwt-access-token-string', description: '발급된 JWT Access Token' })
  accessToken: string;

  @ApiProperty({ example: 'jwt-refresh-token-string', description: '발급된 JWT Refresh Token' })
  refreshToken: string;
}
