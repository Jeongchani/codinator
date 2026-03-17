export interface CreateFeedbackRequest {
  tagIds: number[];
}

export interface CreateFeedbackResponse {
  postId: number;
  selectedTagIds: number[];
}