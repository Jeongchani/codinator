export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v2';
export const ASSET_BASE_URL = import.meta.env.VITE_ASSET_BASE_URL || '';
export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3000';

export const ACCESS_TOKEN_KEY = 'accessToken';
export const LEGACY_ACCESS_TOKEN_KEY = 'token';
export const REFRESH_TOKEN_KEY = 'refreshToken';
export const USER_ID_KEY = 'userId';
export const USER_NICKNAME_KEY = 'nickname';

export type UploadedPostImageResponse = {
  originalImageUrl: string;
  processedImageUrl: string;
  storageKey?: string | null;
  thumbnailUrl?: string | null;
  blurMethod: 'NONE' | 'AUTO' | 'MANUAL';
  aiBlurStatus: 'NONE' | 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
};

type PostImageLike = {
  originalImageUrl?: string | null;
  processedImageUrl?: string | null;
  thumbnailUrl?: string | null;
  isPrimary?: boolean;
  sortOrder?: number;
};

type PostWithImages = {
  images?: PostImageLike[] | null;
};

const trimTrailingSlash = (value: string): string => {
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const resolveApiServerOrigin = (): string => {
  if (ASSET_BASE_URL) {
    return trimTrailingSlash(ASSET_BASE_URL);
  }

  if (/^https?:\/\//.test(API_BASE_URL)) {
    try {
      const url = new URL(API_BASE_URL);
      return `${url.protocol}//${url.host}`;
    } catch {
      return trimTrailingSlash(API_ORIGIN);
    }
  }

  return trimTrailingSlash(API_ORIGIN);
};

export const getAccessToken = (): string | null => {
  return localStorage.getItem(ACCESS_TOKEN_KEY) ?? localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const saveAuthTokens = (accessToken: string, refreshToken?: string): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(LEGACY_ACCESS_TOKEN_KEY, accessToken);

  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
};

export const saveCurrentUser = (user: { id: number; nickname?: string | null }): void => {
  localStorage.setItem(USER_ID_KEY, String(user.id));

  if (user.nickname) {
    localStorage.setItem(USER_NICKNAME_KEY, user.nickname);
  }
};

export const clearAuthTokens = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USER_NICKNAME_KEY);
};

export const getAuthHeaders = (): HeadersInit => {
  const accessToken = getAccessToken();

  return accessToken
    ? {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      }
    : {
        'Content-Type': 'application/json',
      };
};

export const getAuthOnlyHeaders = (): HeadersInit => {
  const accessToken = getAccessToken();

  return accessToken
    ? {
        Authorization: `Bearer ${accessToken}`,
      }
    : {};
};

export const resolveAssetUrl = (url?: string | null): string => {
  if (!url) {
    return '';
  }

  if (/^https?:\/\//.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  const apiServerOrigin = resolveApiServerOrigin();

  if (url.startsWith('/uploads/')) {
    return `${apiServerOrigin}${url}`;
  }

  if (url.startsWith('/')) {
    if (ASSET_BASE_URL) {
      return `${trimTrailingSlash(ASSET_BASE_URL)}${url}`;
    }

    return `${apiServerOrigin}${url}`;
  }

  return url;
};

const pickPrimaryImage = (post?: PostWithImages | null): PostImageLike | null => {
  const images = post?.images ?? [];

  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  const primary = images.find((image) => image?.isPrimary);
  if (primary) {
    return primary;
  }

  return [...images].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0] ?? null;
};

export const getPrimaryPostImageUrl = (post?: PostWithImages | null): string => {
  const image = pickPrimaryImage(post);
  return resolveAssetUrl(image?.processedImageUrl ?? image?.originalImageUrl ?? image?.thumbnailUrl ?? '');
};

const extractErrorMessage = async (response: Response): Promise<string> => {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as {
      message?: string | string[];
      error?: string;
      statusCode?: number;
    };

    if (Array.isArray(payload.message)) {
      return payload.message.join(', ');
    }

    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message;
    }

    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
  }

  const message = await response.text();
  return message || 'API 호출 에러';
};

export const fetcher = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  return response.json() as Promise<T>;
};

export const uploadPostImage = async (file: File): Promise<UploadedPostImageResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/uploads/post-image`, {
    method: 'POST',
    headers: getAuthOnlyHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  return response.json() as Promise<UploadedPostImageResponse>;
};
