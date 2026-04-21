import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { UserEvaluationHistoryController } from './user-evaluation-history.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EvaluationsController, UserEvaluationHistoryController],
  providers: [EvaluationsService],
  exports: [EvaluationsService],
})
export class EvaluationsModule {}
