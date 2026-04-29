import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginRequestDto {
  @ApiProperty({ example: 'test@example.com', description: '로그인 이메일' })
  email: string;

  @ApiProperty({ example: '1234', description: '로그인 비밀번호' })
  password: string;

  @ApiPropertyOptional({ // RememberMe
    example: true,
    default: false,
    description:
      '로그인 상태 유지 여부. ' +
      'true → refresh token 발급 + 세션 저장 (7일 유지). ' +
      'false 또는 미입력 → access token만 발급, 세션 없음 (만료 시 재로그인 필요).',
  })
  rememberMe?: boolean;
}
