import type { Id } from '../common/id';
import type {
  PostStatus,
  PostZone,
  GarmentCategory,
  VoteChoice,
} from '../common/enums';

export interface PostImage {
  id: Id;
  imageUrl: string;
  sortOrder: number;
  isRepresentative: boolean;
}

export interface OutfitItem {
  id: Id;
  category: GarmentCategory;
  itemName: string;
  brand?: string | null;
}

export interface VoteSummary {
  likeCount: number;
  dislikeCount: number;
  totalCount: number;
  likeRate: number; // 0~100
}

export interface FeedbackTagSummary {
  tagId: Id;
  code: string;
  label: string;
  count: number;
}

export interface PostCard {
  postId: Id;
  thumbnailUrl: string;
  status: PostStatus;
  zone: PostZone;
  isAnonymous: boolean;
  evaluationEndsAt?: string | null;
  voteSummary?: VoteSummary; // 랭킹존 카드에서만 노출해도 됨
}

export interface PostDetail {
  postId: Id;
  authorId?: Id | null; // 평가존이면 숨길 수 있음
  status: PostStatus;
  zone: PostZone;
  isAnonymous: boolean;
  content?: string | null;
  createdAt: string;
  evaluationEndsAt?: string | null;

  images: PostImage[];
  outfitItems: OutfitItem[];

  voteSummary: VoteSummary;
  feedbackTags: FeedbackTagSummary[];

  hasVoted: boolean;
  myVote?: VoteChoice | null;
  canVote: boolean;
  canViewFeed: boolean;
}