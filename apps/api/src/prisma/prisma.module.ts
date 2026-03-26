import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

//PrismaService를 Nest에 등록

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {} // 다른 서비스에서 주입 가능하게 export