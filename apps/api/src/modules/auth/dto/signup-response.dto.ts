import { ApiProperty } from '@nestjs/swagger';

export class SignupResponseDto {
  @ApiProperty({ example: 1, description: '생성된 유저 ID' })
  userId: number;

  @ApiProperty({ example: 'test@example.com', description: '회원가입된 이메일' })
  email: string;
}

