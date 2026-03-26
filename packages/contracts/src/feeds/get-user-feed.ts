import type { FeedListItem, FeedPostDetail, PostAuthorSummary } from '../posts/models';

export interface GetUserFeedResponse {
  user: PostAuthorSummary;
  items: FeedListItem[];
}

export type GetFeedPostDetailResponse = FeedPostDetail;
