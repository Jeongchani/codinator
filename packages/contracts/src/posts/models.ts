import type { Id } from '../common/id';
import type { EvaluationStatus, GarmentCategory, PostStatus, RankingPeriod } from '../common/enums';

export interface PostImage {
  id: Id;
  imageUrl: string;
}

export interface OutfitItem {
  id: Id;
  category: GarmentCategory;
  itemName?: string | null;
  brand?: string | null;
}

export interface VoteSummary {
  likeCount: number;
  dislikeCount: number;
  totalCount: number;
  likeRate: number;
}

export interface FeedbackTagSummary {
  tagId: Id;
  code: string;
  label: string;
  count: number;
}

export interface PostAuthorSummary {
  userId: Id;
  nickname: string;
}

export interface PostCoreDetail {
  postId: Id;
  content?: string | null;
  status: PostStatus;
  createdAt: string;
  image: PostImage;
  outfitItems: OutfitItem[];
}

export interface EvaluationInfo {
  id: Id;
  status: EvaluationStatus;
  endsAt: string;
}

export interface MyPostDetail extends PostCoreDetail {
  author: PostAuthorSummary;
  evaluation: EvaluationInfo;
  voteSummary: VoteSummary;
  feedbackSummary: FeedbackTagSummary[];
}

export interface EvaluationPostDetail extends PostCoreDetail {
  evaluation: EvaluationInfo;
  hasVoted: boolean;
  myVoteId: Id | null;
  canVote: boolean;
  voteSummary: VoteSummary;
  feedbackSummary: FeedbackTagSummary[];
}

export interface RankingInfo {
  period: RankingPeriod;
  rank: number;
  startDate: string;
  endDate: string;
}

export interface RankingPostDetail extends PostCoreDetail {
  author: PostAuthorSummary;
  evaluation: EvaluationInfo;
  hasVoted: boolean;
  canVote: false;
  voteSummary: VoteSummary;
  feedbackSummary: FeedbackTagSummary[];
  ranking: RankingInfo;
}

export interface FeedListItem {
  postId: Id;
  thumbnailUrl: string;
  createdAt: string;
  rankingPeriods: RankingPeriod[];
}

export interface FeedPostDetail extends PostCoreDetail {
  author: PostAuthorSummary;
  evaluation: EvaluationInfo;
  voteSummary: VoteSummary;
  feedbackSummary: FeedbackTagSummary[];
  rankingPeriods: RankingPeriod[];
}
