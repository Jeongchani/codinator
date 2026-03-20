import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SeedCheckResponse } from '@codinator/contracts';
import { FindUserByEmailDto } from './dto/find-user-by-email.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('seed-check')
  @ApiOperation({ summary: '개발용 seed 유저 조회 테스트' })
  @ApiBody({ type: FindUserByEmailDto })
  @ApiOkResponse({
    description: '이메일로 seed 유저를 조회한 결과',
    schema: {
      example: {
        found: true,
        user: {
          id: 1,
          email: 'alice@codinator.com',
          nickname: '앨리스',
          createdAt: '2026-03-19T03:00:00.000Z',
        },
      },
    },
  })
  async seedCheck(@Body() body: FindUserByEmailDto): Promise<SeedCheckResponse> {
    return this.usersService.findSeedUserByEmail(body.email);
  }
}
