import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PushTokensController } from './push-tokens.controller';
import { PushTokensService } from './push-tokens.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PushTokensController],
  providers: [PushTokensService],
})
export class PushTokensModule {}
