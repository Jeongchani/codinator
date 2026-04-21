import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ // RememberMe
    example: 'jwt-refresh-token-string',
    description: 'rememberMe=true 일 때만 발급. 미포함이면 세션 없음 (재로그인 필요).',
  })
  refreshToken?: string;
}
