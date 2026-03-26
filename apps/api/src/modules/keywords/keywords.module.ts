import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { KeywordsController } from './keywords.controller';
import { KeywordsService } from './keywords.service';

@Module({
  imports: [PrismaModule],
  controllers: [KeywordsController],
  providers: [KeywordsService],
})
export class KeywordsModule {}
