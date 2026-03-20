import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { HealthModule } from './modules/health/health.module';
import { PostsModule } from './modules/posts/posts.module';
import { UsersModule } from './modules/users/users.module';
import { VotesModule } from './modules/votes/votes.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    EvaluationsModule,
    PostsModule,
    VotesModule,
  ],
})
export class AppModule {}
