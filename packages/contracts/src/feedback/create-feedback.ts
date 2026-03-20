export interface CreateFeedbackRequest {
  tagCodes: string[];
}

export interface CreateFeedbackResponse {
  voteId: number;
  selectedTagIds: number[];
}