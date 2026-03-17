export interface FeedbackTag {
  id: number;
  code: string;
  label: string;
  isActive: boolean;
}

export interface GetTagsResponse {
  items: FeedbackTag[];
}