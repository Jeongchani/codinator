import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, HealthModule, UsersModule, AuthModule, EvaluationsModule],
})
export class AppModule {}
