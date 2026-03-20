import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EvaluationsModule } from '../evaluations/evaluations.module';
import { RankingsModule } from '../rankings/rankings.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [PrismaModule, AuthModule, EvaluationsModule, RankingsModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
