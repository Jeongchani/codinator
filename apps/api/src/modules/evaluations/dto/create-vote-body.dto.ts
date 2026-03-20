import { ApiProperty } from '@nestjs/swagger';
import type { VoteChoice } from '@codinator/contracts';

export class CreateVoteBodyDto {
  @ApiProperty({
    example: 'LIKE',
    enum: ['LIKE', 'DISLIKE'],
    description: '좋아요 / 싫어요 선택',
  })
  choice: VoteChoice;
}
