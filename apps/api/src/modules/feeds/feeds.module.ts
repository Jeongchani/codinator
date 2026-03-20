import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';  // ← 추가
import { PrismaModule } from '../../prisma/prisma.module';
import { FeedController } from './feeds.controller';
import { FeedService } from './feeds.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,  // ← 추가
  ],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
