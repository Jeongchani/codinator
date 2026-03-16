import { ApiProperty } from '@nestjs/swagger';

export class HealthCheckResponseDto {
  @ApiProperty({ example: 'ok', description: '서버 상태' })
  status: string;

  @ApiProperty({ example: 'api', description: '서비스 이름' })
  service: string;

  @ApiProperty({
    example: '2026-03-16T12:00:00.000Z',
    description: '응답 생성 시각',
  })
  timestamp: string;
}