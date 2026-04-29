import { ApiProperty } from '@nestjs/swagger';

export class CreateFeedbackBodyDto {
  @ApiProperty({ example: 3, description: '선택한 피드백 태그 ID' })
  tagId: number;
}
