import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module'; //- AuthModule을 AppModule에 등록 안 함 -> 그럼 Nestjs가 /auth/login 라우트를 모름

@Module({
  imports: [PrismaModule, HealthModule, AuthModule, UsersModule],
})
export class AppModule {}