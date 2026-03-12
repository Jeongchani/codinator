import { Controller, Get } from '@nestjs/common';
import { FeedbackTag } from '@codinator/contracts'; // 💡 공용 패키지 정상 임포트 테스트!

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      testSharedTag: FeedbackTag.FIT_PERFECT // 공용 패키지 연결 확인용
    };
  }
}