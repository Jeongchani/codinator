import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { HealthCheckResponseDto } from './dto/health-check-response.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: '서버 상태 확인' })
  @ApiOkResponse({
    description: '서버가 정상 동작 중일 때 반환',
    type: HealthCheckResponseDto,
  })
  check(): HealthCheckResponseDto {
    return {
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    };
  }
}