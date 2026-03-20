import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FeedService } from './feeds.service';
import { FeedController } from './feeds.controller';

@Module({
  controllers: [FeedController],
  providers: [FeedService, PrismaService],
})
export class FeedModule {}
