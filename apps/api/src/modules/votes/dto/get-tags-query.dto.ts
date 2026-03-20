import { ApiProperty } from '@nestjs/swagger';
import type { VoteChoice } from '@codinator/contracts';

export class GetTagsQueryDto {
  @ApiProperty({
    example: 'DISLIKE',
    enum: ['LIKE', 'DISLIKE'],
    description: '선택한 투표 타입',
  })
  voteChoice: VoteChoice;
}
