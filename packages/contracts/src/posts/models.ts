import type { Id } from '../common/id';
import type { EvaluationStatus, GarmentCategory, PostStatus } from '../common/enums';

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

export interface BasePostDetail {
  postId: Id;
  authorId: Id;
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

export interface EvaluationPostDetail extends BasePostDetail {
  evaluation: EvaluationInfo;
  hasVoted: boolean;
  canVote: boolean;
  voteSummary?: VoteSummary;
  feedbackSummary?: FeedbackTagSummary[];
}
