import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FeedbackTagsController } from './feedback-tags.controller';
import { FeedbackTagsService } from './feedback-tags.service';

@Module({
  imports: [PrismaModule],
  controllers: [FeedbackTagsController],
  providers: [FeedbackTagsService],
})
export class FeedbackTagsModule {}
