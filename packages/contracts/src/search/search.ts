/**
 * GET /search
 *
 * 검색 타입:
 *   - ALL       : 통합 검색 (닉네임 + 키워드 + 게시글 본문)
 *   - NICKNAME  : 사용자 닉네임 부분 일치 검색
 *   - KEYWORD   : 게시글에 연결된 키워드(label) 부분 일치 검색
 *   - POST      : 게시글 본문(content) 부분 일치 검색
 *
 * type 미지정 시 ALL로 처리한다.
 *
 * 공개 가능한 게시글 조건:
 *   - Post.status = ACTIVE
 *   - Post.deletedAt IS NULL
 *   - Post.publishedAt IS NOT NULL
 *   - Evaluation.status = ENDED
 *   - RankingDetail 이 READY Ranking 에 1건 이상 연결
 *
 * 이유:
 *   - OPEN 평가는 익명성 보호를 위해 제외
 *   - HIDDEN / DELETED / 미발행 게시글은 공개 검색 결과에서 제외
 *   - 작성자 닉네임은 랭킹존에서만 노출하는 정책과 충돌하지 않도록
 *     게시글 검색 결과에서는 author를 반환하지 않는다.
 *
 * 공개 가능한 사용자 조건:
 *   - User.status = ACTIVE
 *   - User.deletedAt IS NULL
 */

export type SearchType = 'ALL' | 'NICKNAME' | 'KEYWORD' | 'POST';

export interface UserSearchItem {
  userId: number;
  nickname: string;
  /** 유저의 최근 랭킹 등재 게시글 대표 썸네일. 없으면 null */
  thumbnailUrl: string | null;
}

export interface PostSearchItem {
  postId: number;
  userId: number;
  thumbnailUrl: string | null;
  content: string;
  createdAt: string; // ISO 8601
}

export interface SearchRequest {
  q: string;
  type?: SearchType;
  cursor?: number;
  limit?: number;
}

export interface SearchResponse {
  type: SearchType;
  users: UserSearchItem[];
  posts: PostSearchItem[];
  nextCursor: number | null;
  hasMore: boolean;
}