import { useEffect, useMemo, useRef, useState, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search as SearchIcon,
  X,
  SlidersHorizontal,
  Sparkles,
  ChevronDown,
  UserRound,
  ChevronsUp,
} from "lucide-react";
import Header from "../../components/Header";
import PostDetailBottomSheet from "../../components/postdetail/PostDetailBottomSheet";
import RankingDetail from "../ranking/RankingDetail";
import { getAccessToken, performApiRequest, resolveAssetUrl } from "../../lib/api";
import styles from "./Search.module.css";

type SearchType = "ALL" | "NICKNAME" | "KEYWORD" | "POST";
type ExpandSectionKey = "users" | "posts" | "keywords";

type RecentSearchItem = {
  query: string;
  type: SearchType;
  isAi?: boolean;
};

type SearchUserItem = {
  userId: number;
  nickname: string;
  profileImageUrl?: string;
};

type SearchKeywordPostItem = {
  postId: number;
  imageUrl: string;
  keywordsText: string;
  userId?: number;
};

type SearchPostItem = {
  postId: number;
  imageUrl: string;
  content: string;
  userId?: number;
};

type FocusPostState = {
  postId: number;
  userId: number;
  imageUrl: string;
  description: string;
};

type SearchPageSnapshot = {
  query: string;
  searchType: SearchType;
  searched: boolean;
  searchResult: unknown;
  errorMessage: string;
  visibleCounts: Record<ExpandSectionKey, number>;
  scrollTop: number;
};

type SearchProps = {
  initialRecentSearches?: string[];
};

const HISTORY_KEY_PREFIX = "searchRecentKeywords";
const DEFAULT_VISIBLE_COUNT = 6;
const LOAD_MORE_STEP = 6;

const TYPE_OPTIONS: { value: SearchType; label: string; shortLabel: string }[] = [
  { value: "ALL", label: "전체 검색", shortLabel: "전체" },
  { value: "NICKNAME", label: "닉네임", shortLabel: "닉네임" },
  { value: "KEYWORD", label: "키워드", shortLabel: "키워드" },
  { value: "POST", label: "게시글", shortLabel: "게시글" },
];

const tok = () => getAccessToken() ?? "";

function getDefaultVisibleCounts(): Record<ExpandSectionKey, number> {
  return {
    users: DEFAULT_VISIBLE_COUNT,
    posts: DEFAULT_VISIBLE_COUNT,
    keywords: DEFAULT_VISIBLE_COUNT,
  };
}

async function api<T>(method: string, path: string): Promise<T> {
  const res = await performApiRequest(path, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  });

  const text = await res.text();
  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    const raw = data as Record<string, unknown> | null;
    const msg =
      raw && typeof raw === "object" && "message" in raw
        ? Array.isArray(raw.message)
          ? (raw.message as string[]).join(", ")
          : String(raw.message)
        : text;

    throw new Error(`[${res.status}] ${msg}`);
  }

  return data as T;
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded = atob(padded);

    try {
      const utf8 = decodeURIComponent(
        decoded
          .split("")
          .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
          .join(""),
      );
      return JSON.parse(utf8) as Record<string, unknown>;
    } catch {
      return JSON.parse(decoded) as Record<string, unknown>;
    }
  } catch {
    return null;
  }
}

function getHistoryStorageKey() {
  const accessToken = tok();

  if (!accessToken) {
    return `${HISTORY_KEY_PREFIX}:guest`;
  }

  const payload = parseJwtPayload(accessToken);
  const candidate =
    payload?.sub ??
    payload?.userId ??
    payload?.id ??
    payload?.email ??
    payload?.nickname;

  if (typeof candidate === "string" || typeof candidate === "number") {
    return `${HISTORY_KEY_PREFIX}:${String(candidate)}`;
  }

  return `${HISTORY_KEY_PREFIX}:guest`;
}

function getSearchPageStateKey(historyStorageKey: string) {
  return `${historyStorageKey}:page-state`;
}

function isSearchType(value: unknown): value is SearchType {
  return value === "ALL" || value === "NICKNAME" || value === "KEYWORD" || value === "POST";
}

function normalizeHistoryItem(item: unknown): RecentSearchItem | null {
  if (typeof item === "string") {
    const query = item.trim();
    if (!query) return null;
    return { query, type: "ALL", isAi: false };
  }

  if (!item || typeof item !== "object") return null;

  const raw = item as Record<string, unknown>;
  const query = typeof raw.query === "string" ? raw.query.trim() : "";

  if (!query) return null;

  return {
    query,
    type: isSearchType(raw.type) ? raw.type : "ALL",
    isAi: raw.isAi === true,
  };
}

function getStoredRecentSearches(storageKey: string): RecentSearchItem[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeHistoryItem)
      .filter((item): item is RecentSearchItem => item !== null);
  } catch {
    return [];
  }
}

function saveRecentSearches(storageKey: string, items: RecentSearchItem[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    // noop
  }
}

function isVisibleCountRecord(
  value: unknown,
): value is Record<ExpandSectionKey, number> {
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;

  return (
    typeof record.users === "number" &&
    typeof record.posts === "number" &&
    typeof record.keywords === "number"
  );
}

function getStoredSearchPageSnapshot(
  storageKey: string,
): SearchPageSnapshot | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SearchPageSnapshot>;

    return {
      query: typeof parsed.query === "string" ? parsed.query : "",
      searchType: isSearchType(parsed.searchType) ? parsed.searchType : "ALL",
      searched: parsed.searched === true,
      searchResult: parsed.searchResult ?? null,
      errorMessage:
        typeof parsed.errorMessage === "string" ? parsed.errorMessage : "",
      visibleCounts: isVisibleCountRecord(parsed.visibleCounts)
        ? parsed.visibleCounts
        : getDefaultVisibleCounts(),
      scrollTop:
        typeof parsed.scrollTop === "number" && Number.isFinite(parsed.scrollTop)
          ? parsed.scrollTop
          : 0,
    };
  } catch {
    return null;
  }
}

function saveSearchPageSnapshot(
  storageKey: string,
  snapshot: SearchPageSnapshot,
) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
  } catch {
    // noop
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => toRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null);
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }

  return null;
}

function pickNestedRecord(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const nested = toRecord(record[key]);
    if (nested) return nested;
  }
  return null;
}

function pickNestedNumber(
  record: Record<string, unknown>,
  parentKeys: string[],
  childKeys: string[],
) {
  const nested = pickNestedRecord(record, parentKeys);
  if (!nested) return null;
  return pickNumber(nested, childKeys);
}

function pickImageUrl(record: Record<string, unknown>) {
  const direct = pickString(record, [
    "thumbnailUrl",
    "imageUrl",
    "processedImageUrl",
    "originalImageUrl",
    "coverImageUrl",
    "postImageUrl",
  ]);

  if (direct) return resolveAssetUrl(direct);

  const image = toRecord(record.image);
  if (image) {
    const nestedDirect = pickString(image, [
      "thumbnailUrl",
      "imageUrl",
      "processedImageUrl",
      "originalImageUrl",
      "coverImageUrl",
      "postImageUrl",
    ]);

    if (nestedDirect) return resolveAssetUrl(nestedDirect);
  }

  const post = toRecord(record.post);
  if (post) {
    const postImage = pickString(post, [
      "thumbnailUrl",
      "imageUrl",
      "processedImageUrl",
      "originalImageUrl",
      "coverImageUrl",
      "postImageUrl",
    ]);

    if (postImage) return resolveAssetUrl(postImage);
  }

  const images = record.images;
  if (Array.isArray(images)) {
    for (const item of images) {
      const imageRecord = toRecord(item);
      if (!imageRecord) continue;

      const nested = pickString(imageRecord, [
        "thumbnailUrl",
        "imageUrl",
        "processedImageUrl",
        "originalImageUrl",
        "coverImageUrl",
        "postImageUrl",
      ]);

      if (nested) return resolveAssetUrl(nested);
    }
  }

  return "";
}

function pushKeywordPieces(raw: string, target: string[]) {
  const cleaned = raw.trim();
  if (!cleaned) return;

  const splitCandidates = cleaned
    .split(/[\s,]+/)
    .map((item) => item.replace(/^#/, "").trim())
    .filter(Boolean);

  const values =
    splitCandidates.length > 1
      ? splitCandidates
      : [cleaned.replace(/^#/, "").trim()];

  for (const value of values) {
    if (!value) continue;
    if (!target.includes(value)) {
      target.push(value);
    }
  }
}

function collectKeywordTexts(record: Record<string, unknown>) {
  const result: string[] = [];

  const directValues = [
    pickString(record, ["keyword", "keywordName", "label", "name", "tag"]),
    pickString(record, ["keywordsText", "keywordText"]),
  ].filter(Boolean);

  directValues.forEach((value) => pushKeywordPieces(value, result));

  const keywordRecord = pickNestedRecord(record, ["keywordInfo", "keywordItem"]);
  if (keywordRecord) {
    const nestedValue = pickString(keywordRecord, ["keyword", "keywordName", "label", "name"]);
    if (nestedValue) {
      pushKeywordPieces(nestedValue, result);
    }
  }

  const arrayKeys = ["keywords", "feedbackKeywords", "tags"];

  for (const key of arrayKeys) {
    const value = record[key];

    if (!Array.isArray(value)) continue;

    for (const item of value) {
      if (typeof item === "string") {
        pushKeywordPieces(item, result);
        continue;
      }

      const keywordObj = toRecord(item);
      if (!keywordObj) continue;

      const nested = pickString(keywordObj, [
        "keyword",
        "keywordName",
        "label",
        "name",
        "tag",
      ]);

      if (nested) {
        pushKeywordPieces(nested, result);
      }
    }
  }

  return result;
}

function formatKeywordsText(record: Record<string, unknown>) {
  const keywords = collectKeywordTexts(record);

  if (keywords.length === 0) return "";

  return keywords.map((keyword) => `#${keyword}`).join(" ");
}

function splitHashTags(text: string) {
  return text
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^#/, "").trim())
    .filter(Boolean);
}

function buildCombinedKeywordText(searchedQuery: string, keywordsText: string) {
  const merged: string[] = [];

  splitHashTags(searchedQuery).forEach((tag) => {
    if (!merged.includes(tag)) merged.push(tag);
  });

  splitHashTags(keywordsText).forEach((tag) => {
    if (!merged.includes(tag)) merged.push(tag);
  });

  return merged.map((tag) => `#${tag}`).join(" ");
}

function pickContentText(record: Record<string, unknown>) {
  const direct = pickString(record, ["content", "caption", "description", "body"]);
  if (direct) return direct;

  const post = toRecord(record.post);
  if (post) {
    const nested = pickString(post, ["content", "caption", "description", "body"]);
    if (nested) return nested;
  }

  return "";
}

function collectCandidateArrays(result: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return toRecordArray(result);
  }

  const root = toRecord(result);
  if (!root) return [];

  for (const key of keys) {
    const arr = toRecordArray(root[key]);
    if (arr.length > 0) return arr;
  }

  const items = toRecordArray(root.items);
  if (items.length > 0) return items;

  return [];
}

function normalizeUsers(result: unknown): SearchUserItem[] {
  const items = collectCandidateArrays(result, ["users", "nicknames", "nicknameResults"]);

  const mapped = items
    .map((record): SearchUserItem | null => {
      const userId =
        pickNumber(record, ["userId", "id"]) ??
        pickNestedNumber(record, ["user", "author", "owner"], ["id", "userId"]);

      const nickname =
        pickString(record, ["nickname", "userNickname", "name"]) ||
        pickString(pickNestedRecord(record, ["user", "author", "owner"]) ?? {}, [
          "nickname",
          "userNickname",
          "name",
        ]);

      const profileImageUrl = pickImageUrl(record);

      if (!userId || !nickname) return null;

      return {
        userId,
        nickname,
        ...(profileImageUrl ? { profileImageUrl } : {}),
      };
    })
    .filter((item): item is SearchUserItem => item !== null);

  return Array.from(new Map(mapped.map((item) => [item.userId, item])).values());
}

function normalizeKeywordPosts(result: unknown): SearchKeywordPostItem[] {
  const items = collectCandidateArrays(result, [
    "keywords",
    "keywordPosts",
    "keywordResults",
    "posts",
    "items",
  ]);

  const mapped = items
    .map((record): SearchKeywordPostItem | null => {
      const postId =
        pickNumber(record, ["postId", "id"]) ??
        pickNestedNumber(record, ["post"], ["postId", "id"]);

      const userId =
        pickNumber(record, ["userId", "authorId", "ownerId"]) ??
        pickNestedNumber(record, ["user", "author", "owner"], ["id", "userId"]) ??
        pickNestedNumber(record, ["post"], ["userId", "authorId", "ownerId"]);

      const imageUrl = pickImageUrl(record);
      const keywordsText = formatKeywordsText(record);

      if (!postId || !imageUrl || !keywordsText) return null;

      return {
        postId,
        imageUrl,
        keywordsText,
        ...(userId ? { userId } : {}),
      };
    })
    .filter((item): item is SearchKeywordPostItem => item !== null);

  return Array.from(new Map(mapped.map((item) => [item.postId, item])).values());
}

function normalizePosts(result: unknown): SearchPostItem[] {
  const items = collectCandidateArrays(result, ["posts", "postResults", "contents", "items"]);

  const mapped = items
    .map((record): SearchPostItem | null => {
      const postId =
        pickNumber(record, ["postId", "id"]) ??
        pickNestedNumber(record, ["post"], ["postId", "id"]);

      const userId =
        pickNumber(record, ["userId", "authorId", "ownerId"]) ??
        pickNestedNumber(record, ["user", "author", "owner"], ["id", "userId"]) ??
        pickNestedNumber(record, ["post"], ["userId", "authorId", "ownerId"]);

      const imageUrl = pickImageUrl(record);
      const content = pickContentText(record);

      if (!postId || !imageUrl || !content) return null;

      return {
        postId,
        imageUrl,
        content,
        ...(userId ? { userId } : {}),
      };
    })
    .filter((item): item is SearchPostItem => item !== null);

  return Array.from(new Map(mapped.map((item) => [item.postId, item])).values());
}

function getTypeLabel(type: SearchType) {
  return TYPE_OPTIONS.find((option) => option.value === type)?.shortLabel ?? "전체";
}

function buildSearchPath(finalQuery: string, type: SearchType) {
  return `/search?q=${encodeURIComponent(finalQuery)}&type=${type}`;
}

function makeFallbackKeywordText(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

export default function Search({ initialRecentSearches }: SearchProps) {
  const navigate = useNavigate();

  const historyStorageKey = useMemo(() => getHistoryStorageKey(), []);
  const pageStateStorageKey = useMemo(
    () => getSearchPageStateKey(historyStorageKey),
    [historyStorageKey],
  );
  const initialPageSnapshot = useMemo(
    () => getStoredSearchPageSnapshot(pageStateStorageKey),
    [pageStateStorageKey],
  );

  const initialRecentSearchItems = useMemo(
    () =>
      (initialRecentSearches ?? [])
        .map((item) => normalizeHistoryItem(item))
        .filter((item): item is RecentSearchItem => item !== null),
    [initialRecentSearches],
  );

  const [query, setQuery] = useState(initialPageSnapshot?.query ?? "");
  const [searchType, setSearchType] = useState<SearchType>(
    initialPageSnapshot?.searchType ?? "ALL",
  );
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>(() => {
    const stored = getStoredRecentSearches(getHistoryStorageKey());
    if (stored.length > 0) return stored;
    return (initialRecentSearches ?? [])
      .map((item) => normalizeHistoryItem(item))
      .filter((item): item is RecentSearchItem => item !== null);
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(initialPageSnapshot?.searched ?? false);
  const [searchResult, setSearchResult] = useState<unknown>(
    initialPageSnapshot?.searchResult ?? null,
  );
  const [errorMessage, setErrorMessage] = useState(
    initialPageSnapshot?.errorMessage ?? "",
  );
  const [visibleCounts, setVisibleCounts] = useState<Record<ExpandSectionKey, number>>(
    initialPageSnapshot?.visibleCounts ?? getDefaultVisibleCounts(),
  );
  const [focusPost, setFocusPost] = useState<FocusPostState | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const restoredScrollRef = useRef(false);

  const trimmedQuery = useMemo(() => query.trim(), [query]);
  const loweredQuery = useMemo(() => trimmedQuery.toLowerCase(), [trimmedQuery]);

  const selectedTypeLabel =
    TYPE_OPTIONS.find((option) => option.value === searchType)?.shortLabel ?? "전체";

  const rawUserResults = useMemo(() => normalizeUsers(searchResult), [searchResult]);
  const rawKeywordResults = useMemo(() => normalizeKeywordPosts(searchResult), [searchResult]);
  const rawPostResults = useMemo(() => normalizePosts(searchResult), [searchResult]);

  const displayKeywordResults = useMemo(() => {
    if (rawKeywordResults.length > 0) return rawKeywordResults;

    if (searchType === "KEYWORD" && rawPostResults.length > 0 && trimmedQuery) {
      const fallbackTag = makeFallbackKeywordText(trimmedQuery);

      return rawPostResults.map((item) => ({
        postId: item.postId,
        imageUrl: item.imageUrl,
        userId: item.userId,
        keywordsText: fallbackTag,
      }));
    }

    return [];
  }, [rawKeywordResults, rawPostResults, searchType, trimmedQuery]);

  const userResults = useMemo(() => {
    if (!loweredQuery) return rawUserResults;

    return rawUserResults.filter((item) =>
      item.nickname.toLowerCase().includes(loweredQuery),
    );
  }, [rawUserResults, loweredQuery]);

  const keywordResults = useMemo(() => {
    if (!loweredQuery) return displayKeywordResults;

    const normalizedLoweredQuery = loweredQuery.replace(/^#/, "");

    return displayKeywordResults.filter((item) => {
      const normalizedKeywords = item.keywordsText.toLowerCase();
      return (
        normalizedKeywords.includes(loweredQuery) ||
        normalizedKeywords.includes(normalizedLoweredQuery)
      );
    });
  }, [displayKeywordResults, loweredQuery]);

  const postResults = useMemo(() => {
    if (!loweredQuery) return rawPostResults;

    return rawPostResults.filter((item) =>
      item.content.toLowerCase().includes(loweredQuery),
    );
  }, [rawPostResults, loweredQuery]);

  const shouldShowRecent = !searched && trimmedQuery.length === 0 && recentSearches.length > 0;

  const allVisualResults = useMemo(() => {
    if (searchType !== "ALL") {
      return [] as Array<{
        postId: number;
        imageUrl: string;
        userId?: number;
        description: string;
      }>;
    }

    const combined = [
      ...keywordResults.map((item) => ({
        postId: item.postId,
        imageUrl: item.imageUrl,
        userId: item.userId,
        description: item.keywordsText,
      })),
      ...postResults.map((item) => ({
        postId: item.postId,
        imageUrl: item.imageUrl,
        userId: item.userId,
        description: item.content,
      })),
    ];

    return Array.from(new Map(combined.map((item) => [item.postId, item])).values());
  }, [keywordResults, postResults, searchType]);

  const shouldShowAllVisualSection = searchType === "ALL" && allVisualResults.length > 0;
  const shouldShowUserSection =
    (searchType === "NICKNAME" || searchType === "ALL") && userResults.length > 0;
  const shouldShowPostSection = searchType === "POST" && postResults.length > 0;
  const shouldShowKeywordSection = searchType === "KEYWORD" && keywordResults.length > 0;

  const hasVisualResults =
    shouldShowAllVisualSection || shouldShowUserSection || shouldShowPostSection || shouldShowKeywordSection;

  const visibleUserResults = useMemo(
    () => userResults.slice(0, visibleCounts.users),
    [userResults, visibleCounts.users],
  );
  const visiblePostResults = useMemo(
    () => postResults.slice(0, visibleCounts.posts),
    [postResults, visibleCounts.posts],
  );
  const visibleAllResults = useMemo(
    () => allVisualResults.slice(0, visibleCounts.posts),
    [allVisualResults, visibleCounts.posts],
  );
  const visibleKeywordResults = useMemo(
    () => keywordResults.slice(0, visibleCounts.keywords),
    [keywordResults, visibleCounts.keywords],
  );

  const canLoadMoreUsers = userResults.length > visibleCounts.users;
  const canLoadMoreAll = allVisualResults.length > visibleCounts.posts;
  const canLoadMorePosts = postResults.length > visibleCounts.posts;
  const canLoadMoreKeywords = keywordResults.length > visibleCounts.keywords;

  const persistSearchPageSnapshot = (
    overrides?: Partial<SearchPageSnapshot>,
  ) => {
    saveSearchPageSnapshot(pageStateStorageKey, {
      query,
      searchType,
      searched,
      searchResult,
      errorMessage,
      visibleCounts,
      scrollTop: contentAreaRef.current?.scrollTop ?? 0,
      ...overrides,
    });
  };

  useEffect(() => {
    const stored = getStoredRecentSearches(historyStorageKey);

    if (stored.length > 0) {
      setRecentSearches(stored);
      return;
    }

    setRecentSearches(initialRecentSearchItems);
  }, [historyStorageKey, initialRecentSearchItems]);

  useEffect(() => {
    saveRecentSearches(historyStorageKey, recentSearches);
  }, [historyStorageKey, recentSearches]);

  useEffect(() => {
    persistSearchPageSnapshot();
  }, [
    pageStateStorageKey,
    query,
    searchType,
    searched,
    searchResult,
    errorMessage,
    visibleCounts,
  ]);

  useEffect(() => {
    if (restoredScrollRef.current) return;
    restoredScrollRef.current = true;

    const nextScrollTop = initialPageSnapshot?.scrollTop ?? 0;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (contentAreaRef.current) {
          contentAreaRef.current.scrollTop = nextScrollTop;
        }
      });
    });
  }, [initialPageSnapshot]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!filterRef.current) return;
      if (!filterRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!focusPost) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [focusPost]);

  const pushRecentSearch = (value: string, type: SearchType, isAi = false) => {
    const nextItem: RecentSearchItem = {
      query: value,
      type,
      isAi,
    };

    setRecentSearches((prev) =>
      [
        nextItem,
        ...prev.filter(
          (item) =>
            !(
              item.query === value &&
              item.type === type &&
              item.isAi === isAi
            ),
        ),
      ].slice(0, 10),
    );
  };

  const increaseVisibleCount = (section: ExpandSectionKey) => {
    setVisibleCounts((prev) => ({
      ...prev,
      [section]: prev[section] + LOAD_MORE_STEP,
    }));
  };

  const executeSearch = async (
    targetQuery?: string,
    targetType?: SearchType,
    isAi = false,
  ) => {
    const finalQuery = (targetQuery ?? query).trim();
    const finalType = targetType ?? searchType;
    const requestType = isAi ? "ALL" : finalType;

    if (!finalQuery) {
      setErrorMessage("검색어를 입력하세요");
      setSearchResult(null);
      setSearched(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setSearched(true);
    setVisibleCounts(getDefaultVisibleCounts());

    try {
      let data: unknown;

      if (requestType === "ALL") {
        const [nicknameData, postData, keywordData] = await Promise.all([
          api<unknown>("GET", buildSearchPath(finalQuery, "NICKNAME")),
          api<unknown>("GET", buildSearchPath(finalQuery, "POST")),
          api<unknown>("GET", buildSearchPath(finalQuery, "KEYWORD")),
        ]);

        const normalizedKeywordPosts = normalizeKeywordPosts(keywordData);
        const fallbackKeywordText = makeFallbackKeywordText(finalQuery);

        const fallbackKeywordPosts =
          normalizedKeywordPosts.length > 0
            ? normalizedKeywordPosts
            : normalizePosts(keywordData).map((item) => ({
                postId: item.postId,
                imageUrl: item.imageUrl,
                userId: item.userId,
                keywordsText: fallbackKeywordText,
              }));

        data = {
          users: normalizeUsers(nicknameData),
          posts: normalizePosts(postData),
          keywordPosts: fallbackKeywordPosts,
        };
      } else {
        data = await api<unknown>("GET", buildSearchPath(finalQuery, requestType));
      }

      setSearchResult(data);
      pushRecentSearch(finalQuery, requestType, isAi);
      setQuery(finalQuery);
      setSearchType(requestType);

      saveSearchPageSnapshot(pageStateStorageKey, {
        query: finalQuery,
        searchType: requestType,
        searched: true,
        searchResult: data,
        errorMessage: "",
        visibleCounts: getDefaultVisibleCounts(),
        scrollTop: 0,
      });

      requestAnimationFrame(() => {
        if (contentAreaRef.current) {
          contentAreaRef.current.scrollTop = 0;
        }
      });
    } catch (error) {
      setSearchResult(null);
      setErrorMessage(error instanceof Error ? error.message : "검색 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const openFeedDetail = (
    postId: number,
    imageUrl: string,
    description: string,
    userId?: number,
  ) => {
    if (!userId) {
      setErrorMessage(
        "검색 결과에 userId가 없어서 상세 페이지를 열 수 없어요. search API의 POST/KEYWORD 결과에 userId를 포함해줘야 해요.",
      );
      return;
    }

    persistSearchPageSnapshot();
    setFocusPost({
      postId,
      userId,
      imageUrl,
      description,
    });
    setSheetOpen(true);
  };

  const handleCloseFocus = () => {
    setSheetOpen(false);
    setFocusPost(null);
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      executeSearch();
    }
  };

  const handleClearInput = () => {
    const clearedVisibleCounts = getDefaultVisibleCounts();

    setQuery("");
    setErrorMessage("");
    setSearchResult(null);
    setSearched(false);
    setVisibleCounts(clearedVisibleCounts);

    saveSearchPageSnapshot(pageStateStorageKey, {
      query: "",
      searchType,
      searched: false,
      searchResult: null,
      errorMessage: "",
      visibleCounts: clearedVisibleCounts,
      scrollTop: 0,
    });

    requestAnimationFrame(() => {
      if (contentAreaRef.current) {
        contentAreaRef.current.scrollTop = 0;
      }
    });
  };

  const handleRemoveRecent = (target: RecentSearchItem) => {
    setRecentSearches((prev) =>
      prev.filter(
        (item) =>
          !(
            item.query === target.query &&
            item.type === target.type &&
            item.isAi === target.isAi
          ),
      ),
    );
  };

  const handleClearAllRecent = () => {
    setRecentSearches([]);
  };

  const handleAiSearch = () => {
    setIsFilterOpen(false);
    executeSearch(trimmedQuery || query, "ALL", true);
  };

  const goToUserFeed = (userId: number) => {
    persistSearchPageSnapshot();
    navigate(`/user/${userId}/feed`, {
      state: {
        from: "search",
        userId,
      },
    });
  };

  return (
    <div className={styles.container}>
      <Header title="C:Dinator" />

      <div className={styles.pageBody}>
        <div className={styles.topArea}>
          <div className={styles.searchRow}>
            <div className={styles.searchBar}>
              <button
                type="button"
                onClick={() => executeSearch()}
                aria-label="검색"
                className={styles.searchIconButton}
              >
                <SearchIcon size={18} strokeWidth={2.2} />
              </button>

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="검색어를 입력하세요"
                className={styles.searchInput}
              />

              <button
                type="button"
                onClick={handleClearInput}
                aria-label="입력한 검색어 지우기"
                disabled={query.length === 0}
                className={`${styles.clearInputButton} ${
                  query.length > 0
                    ? styles.clearInputButtonVisible
                    : styles.clearInputButtonHidden
                }`}
              >
                <X size={16} strokeWidth={2.2} />
              </button>
            </div>

            <div className={styles.filterWrap} ref={filterRef}>
              <button
                type="button"
                aria-label="검색 필터"
                className={styles.filterButton}
                onClick={() => setIsFilterOpen((prev) => !prev)}
              >
                <SlidersHorizontal size={16} strokeWidth={2.2} />
                <span className={styles.filterButtonText}>{selectedTypeLabel}</span>
                <ChevronDown size={13} strokeWidth={2.2} />
              </button>

              {isFilterOpen && (
                <div className={styles.filterDropdown}>
                  {TYPE_OPTIONS.map((option) => {
                    const active = option.value === searchType;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`${styles.filterOption} ${
                          active ? styles.filterOptionActive : ""
                        }`}
                        onClick={() => {
                          setSearchType(option.value);
                          setIsFilterOpen(false);
                        }}
                      >
                        <span>{option.label}</span>
                        {active && (
                          <span className={styles.filterOptionCheck}>선택됨</span>
                        )}
                      </button>
                    );
                  })}

                  <div className={styles.dropdownDivider} />

                  <button
                    type="button"
                    className={styles.aiFilterOption}
                    onClick={handleAiSearch}
                  >
                    <div className={styles.aiFilterOptionLeft}>
                      <Sparkles size={15} strokeWidth={2.2} />
                      <span>AI 검색</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.contentArea} ref={contentAreaRef}>
          {shouldShowRecent && (
            <>
              <div className={styles.historyActionRow}>
                <button
                  type="button"
                  onClick={handleClearAllRecent}
                  className={styles.clearAllTextButton}
                >
                  전체 삭제
                </button>
              </div>

              <div className={styles.recentList}>
                {recentSearches.map((item, index) => (
                  <div
                    key={`${item.query}-${item.type}-${item.isAi}-${index}`}
                    className={styles.recentItem}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSearchType(item.type);
                        executeSearch(item.query, item.type, item.isAi);
                      }}
                      className={styles.recentItemMain}
                    >
                      <SearchIcon
                        size={18}
                        strokeWidth={2.1}
                        className={styles.recentItemIcon}
                      />

                      <div className={styles.recentTextWrap}>
                        <span className={styles.recentItemText}>{item.query}</span>
                        <span className={styles.recentTypeBadge}>
                          {item.isAi ? "AI 검색" : getTypeLabel(item.type)}
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveRecent(item)}
                      aria-label={`${item.query} 삭제`}
                      className={styles.recentDeleteButton}
                    >
                      <X size={16} strokeWidth={2.2} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {isLoading && (
            <div className={styles.stateBox}>
              <span className={styles.stateText}>검색 중...</span>
            </div>
          )}

          {!isLoading && errorMessage && (
            <div className={`${styles.stateBox} ${styles.errorBox}`}>
              <span className={styles.errorText}>{errorMessage}</span>
            </div>
          )}

          {!isLoading && searched && !errorMessage && hasVisualResults && (
            <div className={styles.resultWrap}>
              {shouldShowAllVisualSection && (
                <section className={styles.sectionBlock}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>전체 검색</h3>

                    <div className={styles.sectionHeaderRight}>
                      <span className={styles.sectionCount}>{allVisualResults.length}</span>

                      {canLoadMoreAll && (
                        <button
                          type="button"
                          className={styles.moreButton}
                          onClick={() => increaseVisibleCount("posts")}
                        >
                          더보기
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={styles.feedGrid}>
                    {visibleAllResults.map((item) => (
                      <button
                        key={`all-${item.postId}`}
                        type="button"
                        className={styles.feedCard}
                        onClick={() => openFeedDetail(item.postId, item.imageUrl, item.description, item.userId)}
                      >
                        <div className={styles.feedThumbWrap}>
                          <img
                            src={item.imageUrl}
                            alt={item.description}
                            className={styles.feedThumb}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {shouldShowUserSection && (
                <section className={styles.sectionBlock}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>닉네임 검색 결과</h3>

                    <div className={styles.sectionHeaderRight}>
                      <span className={styles.sectionCount}>{userResults.length}</span>

                      {canLoadMoreUsers && (
                        <button
                          type="button"
                          className={styles.moreButton}
                          onClick={() => increaseVisibleCount("users")}
                        >
                          더보기
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={styles.userList}>
                    {visibleUserResults.map((user) => (
                      <button
                        key={user.userId}
                        type="button"
                        className={styles.userItem}
                        onClick={() => goToUserFeed(user.userId)}
                      >
                        <div className={styles.userAvatar}>
                          {user.profileImageUrl ? (
                            <img
                              src={user.profileImageUrl}
                              alt={user.nickname}
                              className={styles.userAvatarImage}
                            />
                          ) : (
                            <UserRound size={18} strokeWidth={2.2} />
                          )}
                        </div>

                        <div className={styles.userInfo}>
                          <span className={styles.userNickname}>{user.nickname}</span>
                          <span className={styles.userSubText}>유저 피드 보러가기</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {shouldShowPostSection && (
                <section className={styles.sectionBlock}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>게시글 검색 결과</h3>

                    <div className={styles.sectionHeaderRight}>
                      <span className={styles.sectionCount}>{postResults.length}</span>

                      {canLoadMorePosts && (
                        <button
                          type="button"
                          className={styles.moreButton}
                          onClick={() => increaseVisibleCount("posts")}
                        >
                          더보기
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={styles.feedGrid}>
                    {visiblePostResults.map((item) => (
                      <button
                        key={`post-${item.postId}`}
                        type="button"
                        className={styles.feedCard}
                        onClick={() => openFeedDetail(item.postId, item.imageUrl, item.content, item.userId)}
                      >
                        <div className={styles.feedThumbWrap}>
                          <img
                            src={item.imageUrl}
                            alt={item.content}
                            className={styles.feedThumb}
                          />
                        </div>
                        <span className={styles.feedMetaText}>{item.content}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {shouldShowKeywordSection && (
                <section className={styles.sectionBlock}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>키워드 검색 결과</h3>

                    <div className={styles.sectionHeaderRight}>
                      <span className={styles.sectionCount}>{keywordResults.length}</span>

                      {canLoadMoreKeywords && (
                        <button
                          type="button"
                          className={styles.moreButton}
                          onClick={() => increaseVisibleCount("keywords")}
                        >
                          더보기
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={styles.feedGrid}>
                    {visibleKeywordResults.map((item) => (
                      <button
                        key={`keyword-${item.postId}`}
                        type="button"
                        className={styles.feedCard}
                        onClick={() => openFeedDetail(item.postId, item.imageUrl, item.keywordsText, item.userId)}
                      >
                        <div className={styles.feedThumbWrap}>
                          <img
                            src={item.imageUrl}
                            alt={item.keywordsText}
                            className={styles.feedThumb}
                          />
                        </div>
                        <span className={styles.feedMetaText}>
                          {buildCombinedKeywordText(trimmedQuery, item.keywordsText)}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {!isLoading && searched && !errorMessage && !hasVisualResults && (
            <div className={styles.stateBox}>
              <span className={styles.stateText}>검색 결과가 없어요</span>
            </div>
          )}

          {!isLoading && !searched && !shouldShowRecent && (
            <div className={styles.stateBox}>
              <span className={styles.stateText}>검색어를 입력해보세요</span>
            </div>
          )}
        </div>
      </div>

      {focusPost ? (
        <div className={styles.focusOverlay} role="dialog" aria-modal="true" aria-label="게시글 포커스 화면">
          <div className={styles.focusFrame}>
            <div
              className={styles.focusImage}
              style={{ backgroundImage: `url(${focusPost.imageUrl})` }}
              aria-hidden="true"
            />
            <div className={styles.focusTopGradient} />
            <div className={styles.focusBottomGradient} />

            <button
              type="button"
              className={styles.focusCloseButton}
              onClick={handleCloseFocus}
              aria-label="포커스 화면 닫기"
            >
              <X size={18} strokeWidth={2.5} />
            </button>

            {sheetOpen ? (
              <button
                type="button"
                className={styles.focusSheetBackdrop}
                onClick={() => setSheetOpen(false)}
                aria-label="상세 닫기"
              />
            ) : null}

            {!sheetOpen ? (
              <div className={styles.focusFloatingArea}>
                <button
                  type="button"
                  className={styles.focusDetailButton}
                  onClick={() => setSheetOpen(true)}
                >
                  <span className={styles.focusDetailButtonText}>상세보기</span>
                  <ChevronsUp size={16} strokeWidth={2.4} className={styles.focusDetailButtonIcon} />
                </button>
              </div>
            ) : null}

            <PostDetailBottomSheet
              isOpen={sheetOpen}
              onCloseRequest={() => setSheetOpen(false)}
            >
              <RankingDetail postId={focusPost.postId} />
            </PostDetailBottomSheet>
          </div>
        </div>
      ) : null}
    </div>
  );
}