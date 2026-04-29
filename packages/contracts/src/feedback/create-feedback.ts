export interface CreateFeedbackRequest {
  tagId: number;
}

export interface CreateFeedbackResponse {
  postId: number;
  selectedTagId: number;
}