import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ImageIndexingService } from './image-indexing.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [AiService, ImageIndexingService],
  exports: [AiService, ImageIndexingService],
})
export class AiModule {}
