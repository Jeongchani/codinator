import { BadRequestException } from '@nestjs/common';
import type { VoteChoice } from '@codinator/contracts';

export function validateVoteChoice(value: VoteChoice, fieldName: string): void {
  if (value !== 'LIKE' && value !== 'DISLIKE') {
    throw new BadRequestException(`${fieldName}는 LIKE 또는 DISLIKE여야 합니다.`);
  }
}
