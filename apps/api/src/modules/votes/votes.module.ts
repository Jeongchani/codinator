import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { VotesController } from './votes.controller';
import { VotesService } from './votes.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [VotesController],
  providers: [VotesService],
})
export class VotesModule {}
