import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PostBookmarksController } from './post-bookmarks.controller';
import { UserBookmarksController } from './user-bookmarks.controller';
import { BookmarksService } from './bookmarks.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PostBookmarksController, UserBookmarksController],
  providers: [BookmarksService],
})
export class BookmarksModule {}
