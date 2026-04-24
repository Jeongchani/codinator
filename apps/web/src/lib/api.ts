import type {
  AddBookmarkResponse,
  BookmarkListItem,
  EvaluationHistoryItem,
  GetEvaluationHistoryResponse,
  GetMyBookmarksResponse,
  LogoutResponse,
  RefreshTokenResponse,
  RemoveBookmarkResponse,
} from "@codinator/contracts";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v3";
export const ASSET_BASE_URL = import.meta.env.VITE_ASSET_BASE_URL || "";
export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "http://localhost:3000";

export const ACCESS_TOKEN_KEY = "accessToken";
export const REFRESH_TOKEN_KEY = "refreshToken";
export const USER_ID_KEY = "userId";
export const USER_NICKNAME_KEY = "nickname";

export const BOOKMARKS_UPDATED_EVENT = "codinator:bookmarks-updated";

export type BookmarkMap = Record<number, boolean>;

export type BookmarkUpdatedDetail = {
  postId: number;
  bookmarked: boolean;
};

export type UploadedPostImageResponse = {
  originalImageUrl: string;
  processedImageUrl: string;
  storageKey?: string | null;
  thumbnailUrl?: string | null;
  blurMethod: "NONE" | "AUTO" | "MANUAL";
  aiBlurStatus: "NONE" | "PENDING" | "PROCESSING" | "DONE" | "FAILED";
  imageAssetId: number
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

let refreshRequestPromise: Promise<string | null> | null = null;

const trimTrailingSlash = (value: string): string => {
  return value.endsWith("/") ? value.slice(0, -1) : value;
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

const resolveApiUrl = (endpoint: string): string => {
  if (/^https?:\/\//.test(endpoint)) {
    return endpoint;
  }

  if (endpoint.startsWith("/")) {
    return `${API_BASE_URL}${endpoint}`;
  }

  return `${API_BASE_URL}/${endpoint}`;
};

const normalizeHeaders = (headers?: HeadersInit): Headers => {
  return new Headers(headers ?? undefined);
};

const withAccessToken = (headers: HeadersInit | undefined, accessToken: string | null): Headers => {
  const nextHeaders = normalizeHeaders(headers);

  if (accessToken) {
    nextHeaders.set("Authorization", `Bearer ${accessToken}`);
  } else {
    nextHeaders.delete("Authorization");
  }

  return nextHeaders;
};

const cloneOptionsWithAccessToken = (
  options?: RequestInit,
  accessToken?: string | null,
): RequestInit => {
  return {
    ...(options ?? {}),
    headers: withAccessToken(options?.headers, accessToken ?? getAccessToken()),
  };
};

export const getAccessToken = (): string | null => {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const shouldKeepLoggedIn = (): boolean => {
  return localStorage.getItem("keepLoggedIn") === "true";
};

export const saveAuthTokens = (accessToken: string, refreshToken?: string): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);

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
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USER_NICKNAME_KEY);
  localStorage.removeItem("keepLoggedIn");
};

export const getAuthHeaders = (): HeadersInit => {
  const accessToken = getAccessToken();

  return accessToken
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      }
    : {
        "Content-Type": "application/json",
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

export const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  if (refreshRequestPromise) {
    return refreshRequestPromise;
  }

  refreshRequestPromise = (async () => {
    const response = await fetch(resolveApiUrl("/auth/refresh"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      clearAuthTokens();
      throw new Error(await extractErrorMessage(response));
    }

    const payload = (await response.json()) as RefreshTokenResponse;
    saveAuthTokens(payload.accessToken, refreshToken);
    return payload.accessToken;
  })()
    .catch((error) => {
      clearAuthTokens();
      throw error;
    })
    .finally(() => {
      refreshRequestPromise = null;
    });

  return refreshRequestPromise;
};

export const performApiRequest = async (
  endpoint: string,
  options?: RequestInit,
  allowRefresh = true,
): Promise<Response> => {
  const requestOptions = cloneOptionsWithAccessToken(options);
  let response = await fetch(resolveApiUrl(endpoint), requestOptions);

  if (
    response.status === 401 &&
    allowRefresh &&
    !endpoint.startsWith("/auth/refresh") &&
    !endpoint.startsWith("/auth/logout") &&
    getRefreshToken()
  ) {
    try {
      const nextAccessToken = await refreshAccessToken();
      if (nextAccessToken) {
        response = await fetch(
          resolveApiUrl(endpoint),
          cloneOptionsWithAccessToken(options, nextAccessToken),
        );
      }
    } catch {
      return response;
    }
  }

  return response;
};

export const resolveAssetUrl = (url?: string | null): string => {
  if (!url) {
    return "";
  }

  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }

  if (url.startsWith("/uploads/")) {
    if (import.meta.env.DEV) {
      return url;
    }

    const apiServerOrigin = resolveApiServerOrigin();
    return `${apiServerOrigin}${url}`;
  }

  if (/^https?:\/\//.test(url)) {
    if (import.meta.env.DEV) {
      try {
        const parsed = new URL(url);

        if (parsed.pathname.startsWith("/uploads/")) {
          return parsed.pathname;
        }
      } catch {
        return url;
      }
    }

    return url;
  }

  if (url.startsWith("/")) {
    if (import.meta.env.DEV) {
      return url;
    }

    if (ASSET_BASE_URL) {
      return `${trimTrailingSlash(ASSET_BASE_URL)}${url}`;
    }

    const apiServerOrigin = resolveApiServerOrigin();
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
  return resolveAssetUrl(image?.processedImageUrl ?? image?.originalImageUrl ?? image?.thumbnailUrl ?? "");
};

const extractErrorMessage = async (response: Response): Promise<string> => {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as {
      message?: string | string[];
      error?: string;
      statusCode?: number;
    };

    if (Array.isArray(payload.message)) {
      return payload.message.join(", ");
    }

    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }

    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  }

  const message = await response.text();
  return message || "API 호출 에러";
};

export const fetcher = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
  const response = await performApiRequest(endpoint, options);

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  return response.json() as Promise<T>;
};

export const uploadPostImage = async (file: File): Promise<UploadedPostImageResponse> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await performApiRequest(
    "/uploads/post-image",
    {
      method: "POST",
      headers: getAuthOnlyHeaders(),
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  return response.json() as Promise<UploadedPostImageResponse>;
};

// 수동블러 전용 헬퍼 함수 추가
export const applyManualBlurByImageAsset = async (
  imageAssetId: number,
  file: File,
) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await performApiRequest(
    `/uploads/image-assets/${imageAssetId}/manual-blur`,
    {
      method: 'PATCH',
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  return response.json();
};

export const logoutWithServer = async (): Promise<void> => {
  const refreshToken = getRefreshToken();

  try {
    if (refreshToken) {
      const response = await performApiRequest(
        "/auth/logout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken }),
        },
        false,
      );

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }

      await response.json().catch(() => ({ success: true } as LogoutResponse));
    }
  } finally {
    clearAuthTokens();
  }
};

export const isAuthError = (message: string): boolean => {
  return (
    message.includes("Unauthorized") ||
    message.includes("로그인이 필요합니다") ||
    message.includes("401")
  );
};

export const buildBookmarkMap = (items: BookmarkListItem[]): BookmarkMap => {
  return items.reduce<BookmarkMap>((acc, item) => {
    acc[item.postId] = true;
    return acc;
  }, {});
};

export const emitBookmarkUpdated = (detail?: BookmarkUpdatedDetail) => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<BookmarkUpdatedDetail | undefined>(BOOKMARKS_UPDATED_EVENT, {
      detail,
    })
  );
};

export const subscribeBookmarkUpdated = (
  listener: (detail?: BookmarkUpdatedDetail) => void
) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<BookmarkUpdatedDetail | undefined>;
    listener(customEvent.detail);
  };

  window.addEventListener(BOOKMARKS_UPDATED_EVENT, handler as EventListener);

  return () => {
    window.removeEventListener(BOOKMARKS_UPDATED_EVENT, handler as EventListener);
  };
};

export const fetchMyBookmarksPage = async (
  cursor?: number
): Promise<GetMyBookmarksResponse> => {
  const query = cursor ? `?cursor=${cursor}` : "";

  return fetcher<GetMyBookmarksResponse>(`/users/me/bookmarks${query}`, {
    headers: getAuthHeaders(),
  });
};

export const fetchAllMyBookmarks = async (): Promise<BookmarkListItem[]> => {
  const items: BookmarkListItem[] = [];
  let cursor: number | undefined;
  let guard = 0;

  while (guard < 20) {
    const page = await fetchMyBookmarksPage(cursor);
    items.push(...(page.items ?? []));

    if (!page.hasMore || !page.nextCursor) {
      break;
    }

    cursor = page.nextCursor;
    guard += 1;
  }

  return items;
};

export const fetchMyBookmarkMap = async (): Promise<BookmarkMap> => {
  const items = await fetchAllMyBookmarks();
  return buildBookmarkMap(items);
};

export const fetchMyEvaluationHistoryPage = async (
  cursor?: number,
  limit?: number
): Promise<GetEvaluationHistoryResponse> => {
  const searchParams = new URLSearchParams();

  if (cursor !== undefined) {
    searchParams.set("cursor", String(cursor));
  }

  if (limit !== undefined) {
    searchParams.set("limit", String(limit));
  }

  const query = searchParams.toString();

  return fetcher<GetEvaluationHistoryResponse>(
    `/users/me/evaluation-history${query ? `?${query}` : ""}`,
    {
      headers: getAuthHeaders(),
    }
  );
};

export const fetchAllMyEvaluationHistory = async (): Promise<EvaluationHistoryItem[]> => {
  const items: EvaluationHistoryItem[] = [];
  let cursor: number | undefined;
  let guard = 0;

  while (guard < 20) {
    const page = await fetchMyEvaluationHistoryPage(cursor);
    items.push(...(page.items ?? []));

    if (!page.hasMore || !page.nextCursor) {
      break;
    }

    cursor = page.nextCursor;
    guard += 1;
  }

  return items;
};

export const setPostBookmark = async (
  postId: number,
  shouldBookmark: boolean
): Promise<boolean> => {
  try {
    if (shouldBookmark) {
      await fetcher<AddBookmarkResponse>(`/posts/${postId}/bookmarks`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
    } else {
      await fetcher<RemoveBookmarkResponse>(`/posts/${postId}/bookmarks`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "북마크 처리에 실패했습니다.";

    if (
      !shouldBookmark &&
      (message.includes("북마크를 찾을 수 없습니다") || message.includes("404"))
    ) {
      emitBookmarkUpdated({ postId, bookmarked: false });
      return false;
    }

    throw err;
  }

  emitBookmarkUpdated({ postId, bookmarked: shouldBookmark });
  return shouldBookmark;
};

export const togglePostBookmark = async (
  postId: number,
  isBookmarked: boolean
): Promise<boolean> => {
  return setPostBookmark(postId, !isBookmarked);
};
