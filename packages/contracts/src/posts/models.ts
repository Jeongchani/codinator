import type { Id } from '../common/id';
import type {
  PostStatus,
  EvaluationStatus,
  GarmentCategory,
  VoteChoice,
} from '../common/enums';

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

export interface PostDetail {
  postId: Id;
  authorId: Id;
  status: PostStatus;
  content?: string | null;
  createdAt: string;

  image: PostImage;

  outfitItems: OutfitItem[];

  evaluation: {
    id: Id;
    status: EvaluationStatus;
    endsAt: string;
  };

  hasVoted: boolean;
  canVote: boolean;
  myVote?: VoteChoice | null;

  voteSummary?: VoteSummary;
  feedbackSummary?: FeedbackTagSummary[];
}