import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// UsersController 등록, UsersService 등록
@Module({
  controllers: [UsersController],  // HTTP 요청 처리
  providers: [UsersService],  // DB 조회 등 비즈니스 로직
})
export class UsersModule {}
//컨틀로러스 : 대문 -> 뭐가 들어오고 분배해주는 역할