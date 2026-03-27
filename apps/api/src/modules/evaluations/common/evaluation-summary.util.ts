import type { FeedbackTagSummary, VoteChoice, VoteSummary } from '@codinator/contracts';

export function buildVoteSummary(votes: Array<{ choice: VoteChoice }>): VoteSummary {
  const likeCount = votes.filter((vote) => vote.choice === 'LIKE').length;
  const dislikeCount = votes.filter((vote) => vote.choice === 'DISLIKE').length;
  const totalCount = votes.length;
  const likeRate = totalCount === 0 ? 0 : Number((likeCount / totalCount).toFixed(4));

  return {
    likeCount,
    dislikeCount,
    totalCount,
    likeRate,
  };
}

export function buildFeedbackSummary(
  votes: Array<{
    choice: VoteChoice;
    feedback?: {
      tag: { id: number; code: string; label: string; voteChoice: VoteChoice };
    } | null;
  }>,
): FeedbackTagSummary[] {
  const summaryMap = new Map<string, FeedbackTagSummary>();

  for (const vote of votes) {
    if (!vote.feedback) {
      continue;
    }

    const key = `${vote.feedback.tag.id}-${vote.choice}`;
    const current = summaryMap.get(key);

    if (current) {
      current.count += 1;
      continue;
    }

    summaryMap.set(key, {
      tagId: vote.feedback.tag.id,
      code: vote.feedback.tag.code,
      label: vote.feedback.tag.label,
      count: 1,
      voteChoice: vote.feedback.tag.voteChoice,

    });
  }

  return Array.from(summaryMap.values()).sort((a, b) => b.count - a.count || a.tagId - b.tagId);
}
