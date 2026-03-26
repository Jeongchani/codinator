import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { FeedsModule } from './modules/feeds/feeds.module';
import { HealthModule } from './modules/health/health.module';
import { KeywordsModule } from './modules/keywords/keywords.module';
import { PostsModule } from './modules/posts/posts.module';
import { RankingsModule } from './modules/rankings/rankings.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { VotesModule } from './modules/votes/votes.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    KeywordsModule,
    PostsModule,
    EvaluationsModule,
    UploadsModule,
    VotesModule,
    RankingsModule,
    FeedsModule,
  ],
})
export class AppModule {}
