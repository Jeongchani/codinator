import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { UserSearchHistoryController } from './user-search-history.controller'; // V3 Batch8
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AuthModule, AiModule],
  controllers: [SearchController, UserSearchHistoryController], // V3 Batch8: UserSearchHistoryController 추가
  providers: [SearchService],
})
export class SearchModule {}
