import { ApiProperty } from '@nestjs/swagger';
import type { Gender } from '@codinator/contracts';

export class SignupRequestDto {
  @ApiProperty({ example: 'test@example.com', description: '회원가입 이메일' })
  email: string;

  @ApiProperty({ example: 'codinator_jc', description: '회원가입 닉네임' })
  nickname: string;

  @ApiProperty({ example: '1234', description: '회원가입 비밀번호' })
  password: string;

  @ApiProperty({ example: '2000-01-01', description: '생년월일(YYYY-MM-DD)' })
  birthDate: string;

  @ApiProperty({
    example: 'MALE',
    enum: ['MALE', 'FEMALE'],
    description: '성별',
  })
  gender: Gender;

  @ApiProperty({
    example: '010-1234-5678',
    description: '전화번호. 저장 시 숫자만 남기고 정규화됨',
  })
  phoneNumber: string;
}
