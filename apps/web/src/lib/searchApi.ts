import type {
  FeedbackTagItem,
  GetFeedbackTagsResponse,
  GetKeywordsResponse,
  GetSearchHistoriesResponse,
  ImageSearchRequest,
  ImageSearchResponse,
  SearchResponse,
  SearchType,
  UploadSearchImageResponse,
} from '@codinator/contracts';
import { fetcher, getAuthHeaders, getAuthOnlyHeaders, performApiRequest } from './api';

export type TextSearchApiParams = {
  q: string;
  type?: SearchType;
  cursor?: number;
  limit?: number;
  periodFrom?: string;
  periodTo?: string;
  likeRatioMin?: number;
  outfitCategories?: string[];
  keywordIds?: number[];
  feedbackLikeTagIds?: number[];
  feedbackDislikeTagIds?: number[];
};

export type ImageSearchApiParams = Omit<ImageSearchRequest, 'imageAssetId'> & {
  imageAssetId: number;
  outfitCategories?: string[];
};

export type SearchHistoryType = 'TEXT' | 'IMAGE';

const appendNumber = (params: URLSearchParams, key: string, value?: number) => {
  if (value === undefined || Number.isNaN(value)) {
    return;
  }

  params.append(key, String(value));
};

const appendString = (params: URLSearchParams, key: string, value?: string) => {
  if (!value) {
    return;
  }

  params.append(key, value);
};

const appendStringArray = (params: URLSearchParams, key: string, values?: string[]) => {
  values?.forEach((value) => {
    if (value) {
      params.append(key, value);
    }
  });
};

const appendNumberArray = (params: URLSearchParams, key: string, values?: number[]) => {
  values?.forEach((value) => {
    if (Number.isInteger(value) && value > 0) {
      params.append(key, String(value));
    }
  });
};

const buildTextSearchQuery = (payload: TextSearchApiParams) => {
  const params = new URLSearchParams();

  params.set('q', payload.q.trim());

  if (payload.type) {
    params.set('type', payload.type);
  }

  appendNumber(params, 'cursor', payload.cursor);
  appendNumber(params, 'limit', payload.limit);
  appendString(params, 'periodFrom', payload.periodFrom);
  appendString(params, 'periodTo', payload.periodTo);
  appendNumber(params, 'likeRatioMin', payload.likeRatioMin);
  appendStringArray(params, 'outfitCategories', payload.outfitCategories);
  appendNumberArray(params, 'keywordIds', payload.keywordIds);
  appendNumberArray(params, 'feedbackLikeTagIds', payload.feedbackLikeTagIds);
  appendNumberArray(params, 'feedbackDislikeTagIds', payload.feedbackDislikeTagIds);

  return params.toString();
};

export const fetchSearchResults = async (payload: TextSearchApiParams): Promise<SearchResponse> => {
  const query = buildTextSearchQuery(payload);

  return fetcher<SearchResponse>(`/search?${query}`, {
    headers: getAuthHeaders(),
  });
};

export const uploadSearchImage = async (file: File): Promise<UploadSearchImageResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await performApiRequest('/uploads/search-image', {
    method: 'POST',
    headers: getAuthOnlyHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || '이미지 업로드에 실패했습니다.');
  }

  return response.json() as Promise<UploadSearchImageResponse>;
};

export const fetchImageSearchResults = async (
  payload: ImageSearchApiParams,
): Promise<ImageSearchResponse> => {
  return fetcher<ImageSearchResponse>('/search/image', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
};

export const fetchKeywordOptions = async () => {
  const response = await fetcher<GetKeywordsResponse>('/keywords', {
    headers: getAuthHeaders(),
  });

  return response.items;
};

export const fetchFeedbackTagOptions = async (): Promise<FeedbackTagItem[]> => {
  const response = await fetcher<GetFeedbackTagsResponse>('/feedback-tags', {
    headers: getAuthHeaders(),
  });

  return response.items;
};

export const fetchSearchHistories = async (searchType?: SearchHistoryType) => {
  const params = new URLSearchParams();
  params.set('limit', '10');

  if (searchType) {
    params.set('searchType', searchType);
  }

  return fetcher<GetSearchHistoriesResponse>(`/users/me/search-histories?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
};

export const deleteSearchHistory = async (historyId: number) => {
  return fetcher<{ success: boolean; message: string }>(`/search/histories/${historyId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
};