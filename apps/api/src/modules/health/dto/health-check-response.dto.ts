import { ApiProperty } from '@nestjs/swagger';

export class HealthCheckResponseDto {
  @ApiProperty({ example: 'ok', description: '서버 상태' })
  status: 'ok';

  @ApiProperty({
    example: '2026-03-19T12:00:00.000Z',
    description: '응답 생성 시각',
  })
  timestamp: string;
}