import { ApiProperty } from '@nestjs/swagger';
import type { Gender } from '@codinator/contracts';

export class SignupResponseDto {
  @ApiProperty({ example: 1, description: '생성된 유저 ID' })
  userId: number;

  @ApiProperty({ example: 'test@example.com', description: '회원가입된 이메일' })
  email: string;

  @ApiProperty({ example: 'codinator_jc', description: '회원가입된 닉네임' })
  nickname: string;

  @ApiProperty({ example: '2000-01-01', description: '회원가입된 생년월일' })
  birthDate: string;

  @ApiProperty({ example: 'MALE', enum: ['MALE', 'FEMALE'], description: '회원가입된 성별' })
  gender: Gender;

  @ApiProperty({
    example: '01012345678',
    description: '정규화 후 저장된 전화번호(숫자만)',
  })
  phoneNumber: string;
}
