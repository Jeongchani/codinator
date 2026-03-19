import { ApiProperty } from '@nestjs/swagger';

// 컨트롤러에서 body타입으로 사용
export class FindUserByEmailDto {
  @ApiProperty({
    example: 'test1@codinator.com',
    description: '조회할 seed 유저 이메일',
  })
  email: string;
}