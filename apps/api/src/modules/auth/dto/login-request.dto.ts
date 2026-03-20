import { ApiProperty } from '@nestjs/swagger';

export class LoginRequestDto {
  @ApiProperty({ example: 'test@example.com', description: '로그인 이메일' })
  email: string;

  @ApiProperty({ example: '1234', description: '로그인 비밀번호' })
  password: string;
}
