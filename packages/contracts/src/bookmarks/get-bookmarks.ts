import type { PostStatus } from '../common/enums';

export interface BookmarkListItem {
  bookmarkId: number;
  postId: number;
  thumbnailUrl: string | null;
  content: string | null;
  postStatus: PostStatus;
  bookmarkedAt: string; // ISO 8601
}

export interface GetMyBookmarksResponse {
  items: BookmarkListItem[];
  nextCursor: number | null; // 다음 페이지 요청 시 cursor 값 (마지막 bookmarkId)
  hasMore: boolean;
}
