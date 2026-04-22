import type { Id } from '../common/id';
import type {
  AiBlurStatus,
  BlurMethod,
  EvaluationStatus,
  GarmentCategory,
  PostStatus,
  RankingPeriod,
  VoteChoice,
} from '../common/enums';

export interface PostImage {
  id: Id;
  storageKey?: string | null;
  originalImageUrl: string;
  processedImageUrl?: string | null;
  thumbnailUrl?: string | null;
  blurMethod: BlurMethod;
  aiBlurStatus: AiBlurStatus;
  sortOrder: number;
  isPrimary: boolean;
}

export interface KeywordSummary {
  id: Id;
  code: string;
  label: string;
  sortOrder: number;
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
  voteChoice: VoteChoice;
}

export interface PostAuthorSummary {
  userId: Id;
  nickname: string;
}

export interface EvaluationInfo {
  id: Id;
  status: EvaluationStatus;
  endsAt: string;
}

export interface MyVoteContext {
  myVoteId: Id | null;
  myVoteChoice: VoteChoice | null;
  myFeedbackTagIds: Id[];
}

export interface PostCoreDetail {
  postId: Id;
  content?: string | null;
  status: PostStatus;
  createdAt: string;
  images: PostImage[];
  keywords: KeywordSummary[];
  outfitItems: OutfitItem[];
}

export interface MyPostDetail extends PostCoreDetail, MyVoteContext {
  author: PostAuthorSummary;
  evaluation: EvaluationInfo;
  voteSummary: VoteSummary;
  feedbackSummary: FeedbackTagSummary[];
}

export interface EvaluationPostDetail extends PostCoreDetail, MyVoteContext {
  evaluation: EvaluationInfo;
  hasVoted: boolean;
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

export interface RankingPostDetail extends PostCoreDetail, MyVoteContext {
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
  thumbnailUrl: string | null;
  createdAt: string;
  rankingPeriods: RankingPeriod[];
}

export interface FeedPostDetail extends PostCoreDetail, MyVoteContext {
  author: PostAuthorSummary;
  evaluation: EvaluationInfo;
  voteSummary: VoteSummary;
  feedbackSummary: FeedbackTagSummary[];
  rankingPeriods: RankingPeriod[];
}
