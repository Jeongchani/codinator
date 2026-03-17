import type { PostCard } from './models';
import type { PostZone } from '../common/enums';

export interface ListPostsRequest {
  zone: PostZone; // EVALUATION | RANKING
  cursor?: number;
  limit?: number;
}

export interface ListPostsResponse {
  items: PostCard[];
  nextCursor?: number | null;
}