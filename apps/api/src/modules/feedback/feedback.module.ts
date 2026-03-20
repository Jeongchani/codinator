import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';  // ← 추가
import { PrismaModule } from '../../prisma/prisma.module';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,  // ← 추가
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
