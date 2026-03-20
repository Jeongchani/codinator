import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { EvaluationPostsController } from './posts.controller';
import { EvaluationPostsService } from './posts.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EvaluationPostsController],
  providers: [EvaluationPostsService],
  exports: [EvaluationPostsService],
})
export class EvaluationPostsModule {}
