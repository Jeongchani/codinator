import { ApiProperty } from '@nestjs/swagger';
import type { VoteChoice } from '@codinator/contracts';

export class GetTagsQueryDto {
  @ApiProperty({
    example: 'DISLIKE',
    enum: ['LIKE', 'DISLIKE'],
    description: '투표 타입 (LIKE → 긍정 태그, DISLIKE → 부정 태그)',
  })
  voteChoice: VoteChoice;
}
