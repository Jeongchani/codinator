// Batch5: V3 응답 shape — postId / status / deletedAt
export interface DeletePostResponse {
  postId: number;
  status: 'DELETED';
  deletedAt: string; // ISO 8601
}
