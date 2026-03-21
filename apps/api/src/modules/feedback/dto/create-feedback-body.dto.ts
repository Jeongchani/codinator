import { ApiProperty } from '@nestjs/swagger';

export class CreateFeedbackBodyDto {
  @ApiProperty({
    example: 3,
    description: '선택할 피드백 태그 ID (v1에서는 1개만 선택 가능)',
  })
  tagId: number;
}
