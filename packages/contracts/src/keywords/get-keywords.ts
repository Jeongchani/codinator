import type { Id } from '../common/id';

export interface KeywordItem {
  id: Id;
  code: string;
  label: string;
  sortOrder: number;
}

export interface GetKeywordsResponse {
  items: KeywordItem[];
}
