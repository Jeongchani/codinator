import { ApiProperty } from '@nestjs/swagger';
import type { SeedCheckRequest } from '@codinator/contracts';

export class FindUserByEmailDto implements SeedCheckRequest {
  @ApiProperty({
    example: 'alice@codinator.com',
    description: '조회할 seed 유저 이메일',
  })
  email: string;
}