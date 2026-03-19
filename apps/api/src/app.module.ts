import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

// NestJS의 모듈 시스템을 사용하여 애플리케이션의 루트 모듈 정의

@Module({ // 모듈 역할 적기
  imports: [PrismaModule,  // DB연결 도구
            HealthModule,  // 헬스체크 API
            UsersModule    // 사용자 관련 API
          ], 
})
export class AppModule {}