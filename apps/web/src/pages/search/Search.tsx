import { useEffect, useMemo, useRef, useState, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search as SearchIcon,
  X,
  SlidersHorizontal,
  Sparkles,
  ChevronDown,
  UserRound,
} from "lucide-react";
import Header from "../../components/Header";
import { resolveAssetUrl } from "../../lib/api";
import styles from "./Search.module.css";

type SearchType = "ALL" | "NICKNAME" | "KEYWORD" | "POST";

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

type SearchProps = {
  initialRecentSearches?: string[];
};

const BASE = "/api/v2";
const HISTORY_KEY = "searchRecentKeywords";

const tok = () => localStorage.getItem("accessToken") ?? "";

const TYPE_OPTIONS: { value: SearchType; label: string; shortLabel: string }[] = [
  { value: "ALL", label: "전체 검색", shortLabel: "전체" },
  { value: "NICKNAME", label: "닉네임", shortLabel: "닉네임" },
  { value: "KEYWORD", label: "키워드", shortLabel: "키워드" },
  { value: "POST", label: "게시글", shortLabel: "게시글" },
];

async function api<T>(method: string, path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tok()}`,
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

function getStoredRecentSearches(): RecentSearchItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
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

function saveRecentSearches(items: RecentSearchItem[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
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
    if (typeof value === "number" && Number.isFinite(value)) return value;
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

  const values = splitCandidates.length > 1 ? splitCandidates : [cleaned.replace(/^#/, "").trim()];

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

function collectCandidateArrays(
  result: unknown,
  keys: string[],
): Record<string, unknown>[] {
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

  return items
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
}

function normalizeKeywordPosts(result: unknown): SearchKeywordPostItem[] {
  const items = collectCandidateArrays(result, [
    "keywords",
    "keywordPosts",
    "keywordResults",
    "posts",
    "items",
  ]);

  return items
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
}

function normalizePosts(result: unknown): SearchPostItem[] {
  const items = collectCandidateArrays(result, [
    "posts",
    "postResults",
    "contents",
    "items",
  ]);

  return items
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
}

function getTypeLabel(type: SearchType) {
  return TYPE_OPTIONS.find((option) => option.value === type)?.shortLabel ?? "전체";
}

export default function Search({
  initialRecentSearches,
}: SearchProps) {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("ALL");
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>(() => {
    const stored = getStoredRecentSearches();

    if (stored.length > 0) {
      return stored;
    }

    return (initialRecentSearches ?? [])
      .map((item) => normalizeHistoryItem(item))
      .filter((item): item is RecentSearchItem => item !== null);
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchResult, setSearchResult] = useState<unknown>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const filterRef = useRef<HTMLDivElement>(null);
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
      const fallbackTag = trimmedQuery.startsWith("#")
        ? trimmedQuery
        : `#${trimmedQuery}`;

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

    return displayKeywordResults.filter((item) =>
      item.keywordsText.toLowerCase().includes(loweredQuery.replace(/^#/, "")) ||
      item.keywordsText.toLowerCase().includes(loweredQuery),
    );
  }, [displayKeywordResults, loweredQuery]);

  const postResults = useMemo(() => {
    if (!loweredQuery) return rawPostResults;
    return rawPostResults.filter((item) =>
      item.content.toLowerCase().includes(loweredQuery),
    );
  }, [rawPostResults, loweredQuery]);

  const shouldShowRecent = !searched && trimmedQuery.length === 0 && recentSearches.length > 0;
  const hasVisualResults =
    userResults.length > 0 || keywordResults.length > 0 || postResults.length > 0;

  useEffect(() => {
    saveRecentSearches(recentSearches);
  }, [recentSearches]);

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

    try {
      const data = await api<unknown>(
        "GET",
        `/search?q=${encodeURIComponent(finalQuery)}&type=${requestType}`,
      );

      setSearchResult(data);
      pushRecentSearch(finalQuery, requestType, isAi);
      setQuery(finalQuery);
      setSearchType(requestType);
    } catch (error) {
      setSearchResult(null);
      setErrorMessage(error instanceof Error ? error.message : "검색 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const openFeedDetail = (postId: number, userId?: number) => {
    if (!userId) {
      setErrorMessage(
        "검색 결과에 userId가 없어서 상세 페이지로 이동할 수 없어요. search API의 POST/KEYWORD 결과에 userId를 포함해줘야 해요.",
      );
      return;
    }

    navigate(`/user/${userId}/feed/${postId}`);
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      executeSearch();
    }
  };

  const handleClearInput = () => {
    setQuery("");
    setErrorMessage("");
    setSearchResult(null);
    setSearched(false);
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
    navigate(`/user/${userId}/feed`);
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

        <div className={styles.contentArea}>
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
              {userResults.length > 0 && (
                <section className={styles.sectionBlock}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>닉네임 검색 결과</h3>
                    <span className={styles.sectionCount}>{userResults.length}</span>
                  </div>

                  <div className={styles.userList}>
                    {userResults.map((user) => (
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

              {keywordResults.length > 0 && (
                <section className={styles.sectionBlock}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>키워드 검색 결과</h3>
                    <span className={styles.sectionCount}>{keywordResults.length}</span>
                  </div>

                  <div className={styles.feedGrid}>
                    {keywordResults.map((item) => (
                      <button
                        key={`keyword-${item.postId}`}
                        type="button"
                        className={styles.feedCard}
                        onClick={() => openFeedDetail(item.postId, item.userId)}
                      >
                        <div className={styles.feedThumbWrap}>
                          <img
                            src={item.imageUrl}
                            alt={item.keywordsText}
                            className={styles.feedThumb}
                          />
                        </div>
                        <span className={styles.feedMetaText}>{item.keywordsText}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {searchType !== "KEYWORD" && postResults.length > 0 && (
                <section className={styles.sectionBlock}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>게시글 검색 결과</h3>
                    <span className={styles.sectionCount}>{postResults.length}</span>
                  </div>

                  <div className={styles.feedGrid}>
                    {postResults.map((item) => (
                      <button
                        key={`post-${item.postId}`}
                        type="button"
                        className={styles.feedCard}
                        onClick={() => openFeedDetail(item.postId, item.userId)}
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
    </div>
  );
}