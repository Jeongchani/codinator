import type { FeedbackTagSummary, VoteChoice, VoteSummary } from '@codinator/contracts';

export type VoteWithFeedbackTags = {
  id: number;
  voterId: number;
  choice: VoteChoice;
  feedbacks?: Array<{
    tag: {
      id: number;
      code: string;
      label: string;
      voteChoice: VoteChoice;
    };
  }>;
};

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

export function buildFeedbackSummary(votes: VoteWithFeedbackTags[]): FeedbackTagSummary[] {
  const summaryMap = new Map<string, FeedbackTagSummary>();

  for (const vote of votes) {
    for (const feedback of vote.feedbacks ?? []) {
      const key = `${feedback.tag.id}-${feedback.tag.voteChoice}`;
      const current = summaryMap.get(key);

      if (current) {
        current.count += 1;
        continue;
      }

      summaryMap.set(key, {
        tagId: feedback.tag.id,
        code: feedback.tag.code,
        label: feedback.tag.label,
        count: 1,
        voteChoice: feedback.tag.voteChoice,
      });
    }
  }

  return Array.from(summaryMap.values()).sort(
    (a, b) => b.count - a.count || a.tagId - b.tagId,
  );
}

export function buildMyVoteContext(votes: VoteWithFeedbackTags[], userId: number) {
  const myVote = votes.find((vote) => vote.voterId === userId) ?? null;

  return {
    hasVoted: !!myVote,
    myVoteId: myVote?.id ?? null,
    myVoteChoice: myVote?.choice ?? null,
    myFeedbackTagIds: (myVote?.feedbacks ?? []).map((feedback) => feedback.tag.id),
  };
}
