import { ApiProperty } from '@nestjs/swagger';

export class FindUserByEmailDto {
  @ApiProperty({
    example: 'test1@codinator.com',
    description: '조회할 seed 유저 이메일',
  })
  email: string;
}