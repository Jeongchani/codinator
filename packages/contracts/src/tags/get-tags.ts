export interface FeedbackTag {
  id: number;
  code: string;
  label: string;
  polarity: 'POSITIVE' | 'NEGATIVE';
  voteChoice: 'LIKE' | 'DISLIKE';
  isActive: boolean;
}

export interface GetTagsResponse {
  items: FeedbackTag[];
}