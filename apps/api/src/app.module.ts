import { Module } from '@nestjs/common';
import { AdminModule } from './modules/admin/admin.module';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookmarksModule } from './modules/bookmarks/bookmarks.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { FeedsModule } from './modules/feeds/feeds.module';
import { HealthModule } from './modules/health/health.module';
import { KeywordsModule } from './modules/keywords/keywords.module';
import { PostsModule } from './modules/posts/posts.module';
import { RankingsModule } from './modules/rankings/rankings.module';
import { ReportsModule } from './modules/reports/reports.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { UsersModule } from './modules/users/users.module';
import { VotesModule } from './modules/votes/votes.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    AdminModule,
    UsersModule,
    KeywordsModule,
    AiModule,
    PostsModule,
    BookmarksModule,
    ReportsModule,
    EvaluationsModule,
    UploadsModule,
    VotesModule,
    RankingsModule,
    FeedsModule,
  ],
})
export class AppModule {}
