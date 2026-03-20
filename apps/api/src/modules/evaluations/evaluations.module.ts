import { Module } from '@nestjs/common';
import { EvaluationPostsModule } from './posts/posts.module';
import { EvaluationVotesModule } from './votes/votes.module';

@Module({
  imports: [EvaluationPostsModule, EvaluationVotesModule],
})
export class EvaluationsModule {}
