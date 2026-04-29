import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PostReportsController } from './post-reports.controller';
import { UserReportsController } from './user-reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PostReportsController, UserReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
