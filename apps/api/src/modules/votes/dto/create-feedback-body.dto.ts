import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFeedbackBodyDto {
  @ApiPropertyOptional({
    type: [Number],
    example: [3, 4],
    description: '선택한 피드백 태그 ID 목록. 최대 3개, 중복 불가.',
  })
  tagIds?: number[];
}
