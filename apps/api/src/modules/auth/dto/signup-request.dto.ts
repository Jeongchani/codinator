import { ApiProperty } from '@nestjs/swagger';

export class SignupRequestDto {
  @ApiProperty({ example: 'test@example.com', description: '회원가입 이메일' })
  email: string;

  @ApiProperty({ example: '1234', description: '회원가입 비밀번호' })
  password: string;

  @ApiProperty({ example: '2000-01-01', description: '생년월일 (YYYY-MM-DD)' })
  birthDate: string;

  @ApiProperty({ example: 'M', description: '성별 (M/F)' })
  gender: 'M' | 'F';

  @ApiProperty({ example: '01012345678', description: '전화번호' })
  phoneNumber: string;
}
