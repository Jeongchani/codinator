import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RankingsModule } from '../rankings/rankings.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { FeedsController } from './feeds.controller';
import { FeedsService } from './feeds.service';

@Module({
  imports: [PrismaModule, AuthModule, RankingsModule],
  controllers: [FeedsController],
  providers: [FeedsService],
  exports: [FeedsService],
})
export class FeedsModule {}
