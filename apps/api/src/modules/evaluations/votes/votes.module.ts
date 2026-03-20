import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { EvaluationVotesController } from './votes.controller';
import { EvaluationVotesService } from './votes.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EvaluationVotesController],
  providers: [EvaluationVotesService],
  exports: [EvaluationVotesService],
})
export class EvaluationVotesModule {}
