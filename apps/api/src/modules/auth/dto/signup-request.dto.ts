import { ApiProperty } from '@nestjs/swagger';

export class SignupRequestDto {
  @ApiProperty({ example: 'test@example.com', description: '회원가입 이메일' })
  email: string;

  @ApiProperty({ example: 'codinator_jc', description: '회원가입 닉네임' })
  nickname: string;

  @ApiProperty({ example: '1234', description: '회원가입 비밀번호' })
  password: string;
}
