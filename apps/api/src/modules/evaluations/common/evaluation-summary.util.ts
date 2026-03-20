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
    feedbackTags: Array<{
      tag: { id: number; code: string; label: string };
    }>;
  }>,
): FeedbackTagSummary[] {
  const summaryMap = new Map<number, FeedbackTagSummary>();

  for (const vote of votes) {
    for (const feedbackTag of vote.feedbackTags) {
      const current = summaryMap.get(feedbackTag.tag.id);

      if (current) {
        current.count += 1;
        continue;
      }

      summaryMap.set(feedbackTag.tag.id, {
        tagId: feedbackTag.tag.id,
        code: feedbackTag.tag.code,
        label: feedbackTag.tag.label,
        count: 1,
      });
    }
  }

  return Array.from(summaryMap.values()).sort((a, b) => b.count - a.count || a.tagId - b.tagId);
}
