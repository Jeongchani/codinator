import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FindUserByEmailDto } from './dto/find-user-by-email.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('seed-check')
  @ApiOperation({ summary: 'seed 유저 조회 테스트' })
  @ApiBody({ type: FindUserByEmailDto })
  @ApiOkResponse({
    description: '이메일로 seed 유저를 조회한 결과',
    schema: {
      example: {
        found: true,
        user: {
          id: 1,
          email: 'test1@codinator.com',
          gender: 'M',
          birthDate: '2000-01-01T00:00:00.000Z',
          phoneNumber: '01011112222',
          createdAt: '2026-03-18T03:00:00.000Z',
        },
      },
    },
  })
  async seedCheck(@Body() body: FindUserByEmailDto) {
    return this.usersService.findSeedUserByEmail(body.email);
  }
}