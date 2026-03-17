import type { Id } from '../common/id';
import type { PostCard } from '../posts/models';

export interface GetUserFeedResponse {
  userId: Id;
  items: PostCard[]; // 여기엔 RANKED 게시글만 포함
}