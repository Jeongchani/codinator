import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, ImagePlus, Search as SearchIcon, X } from 'lucide-react';
import type {
  AiGarmentCategory,
  FeedbackTagItem,
  ImageSearchItem,
  KeywordItem,
  PostSearchItem,
  SearchType,
  UserSearchItem,
  VoteChoice,
} from '@codinator/contracts';
import Header from '../../components/Header';
import PostDetailBottomSheet from '../../components/postdetail/PostDetailBottomSheet';
import FocusScreen from '../../components/focus/FocusScreen';
import { resolveAssetUrl } from '../../lib/api';
import SearchFilterSheet, {
  createEmptySearchFilters,
  getSearchFilterSummary,
  hasSearchFilterValue,
} from './SearchFilterSheet';
import type {
  PeriodFilterValue,
  SearchFilterFeedbackTagOption,
  SearchFilterId,
  SearchFilterKeywordOption,
  SearchFiltersValue,
} from './SearchFilterSheet';
import {
  deleteSearchHistory,
  fetchFeedbackTagOptions,
  fetchImageSearchResults,
  fetchKeywordOptions,
  fetchSearchHistories,
  fetchSearchResults,
  uploadSearchImage,
} from '../../lib/searchApi';
import styles from './Search.module.css';

type SearchMode = 'text' | 'image';

type SearchFilter = {
  id: SearchFilterId;
  label: string;
};

type RecentKeyword = {
  historyId: number;
  query: string;
};

type ResultCardItem = {
  key: string;
  postId?: number;
  userId: number;
  title: string;
  imageUrl: string;
};

type FocusPostState = {
  postId: number;
  userId: number;
  title: string;
  imageUrl: string;
};

type ApiFilterPayload = {
  periodFrom?: string;
  periodTo?: string;
  likeRatioMin?: number;
  outfitCategories?: string[];
  keywordIds?: number[];
  feedbackLikeTagIds?: number[];
  feedbackDislikeTagIds?: number[];
  garmentCategory?: AiGarmentCategory;
};

const FILTERS: SearchFilter[] = [
  { id: 'period', label: '기간' },
  { id: 'likeRatio', label: '좋아요 비율' },
  { id: 'outfit', label: '아웃핏' },
  { id: 'keyword', label: '키워드' },
  { id: 'feedbackTag', label: '피드백 태그' },
];

const TYPE_OPTIONS: Array<{ value: SearchType; label: string; shortLabel: string }> = [
  { value: 'ALL', label: '전체 검색', shortLabel: '전체' },
  { value: 'NICKNAME', label: '닉네임', shortLabel: '닉네임' },
  { value: 'KEYWORD', label: '키워드', shortLabel: '키워드' },
  { value: 'POST', label: '게시글', shortLabel: '게시글' },
  { value: 'OUTFIT_ITEM', label: '아이템명', shortLabel: '아이템' },
  { value: 'OUTFIT_BRAND', label: '브랜드', shortLabel: '브랜드' },
];

const PLACEHOLDER_RESULTS = Array.from({ length: 9 }, (_, index) => index + 1);
const SEARCH_LIMIT = 50;

const OUTFIT_CATEGORY_MAP: Record<string, AiGarmentCategory> = {
  아우터: 'OUTER',
  상의: 'TOP',
  하의: 'BOTTOM',
  신발: 'SHOES',
  가방: 'BAG',
  악세사리: 'ACCESSORY',
  액세서리: 'ACCESSORY',
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

const formatResultCount = (count: number) => count.toLocaleString('ko-KR').padStart(2, '0');

const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${date}`;
};

const toStartOfDayIso = (dateValue: string) => {
  const date = new Date(`${dateValue}T00:00:00`);
  return date.toISOString();
};

const toEndOfDayIso = (dateValue: string) => {
  const date = new Date(`${dateValue}T23:59:59.999`);
  return date.toISOString();
};

const getPeriodRange = (period: PeriodFilterValue | null) => {
  if (!period || period.preset === 'all') {
    return {};
  }

  const today = new Date();
  const endDate = getTodayDateString();
  const start = new Date(today);

  if (period.preset === 'today') {
    return {
      periodFrom: toStartOfDayIso(endDate),
      periodTo: toEndOfDayIso(endDate),
    };
  }

  if (period.preset === 'week') {
    const day = start.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + mondayOffset);
  }

  if (period.preset === 'month') {
    start.setDate(1);
  }

  if (period.preset === 'year') {
    start.setMonth(0, 1);
  }

  if (period.preset === 'custom') {
    const startDate = period.startDate ?? endDate;
    const customEndDate = period.endDate ?? endDate;

    return {
      periodFrom: toStartOfDayIso(startDate),
      periodTo: toEndOfDayIso(customEndDate),
    };
  }

  const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(
    start.getDate(),
  ).padStart(2, '0')}`;

  return {
    periodFrom: toStartOfDayIso(startDate),
    periodTo: toEndOfDayIso(endDate),
  };
};

const buildApiFilters = (filters: SearchFiltersValue): ApiFilterPayload => {
  const period = getPeriodRange(filters.period);
  const outfitCategories = filters.outfits
    .map((outfit) => OUTFIT_CATEGORY_MAP[outfit])
    .filter((category): category is AiGarmentCategory => Boolean(category));
  const keywordIds = filters.keywords.map((keyword) => keyword.id).filter((id) => id > 0);
  const feedbackLikeTagIds = filters.feedbackTags
    .filter((tag) => tag.voteChoice === 'LIKE')
    .map((tag) => tag.id)
    .filter((id) => id > 0);
  const feedbackDislikeTagIds = filters.feedbackTags
    .filter((tag) => tag.voteChoice === 'DISLIKE')
    .map((tag) => tag.id)
    .filter((id) => id > 0);

  return {
    ...period,
    likeRatioMin: filters.likeRatio !== null ? filters.likeRatio / 100 : undefined,
    outfitCategories,
    keywordIds,
    feedbackLikeTagIds,
    feedbackDislikeTagIds,
    garmentCategory: outfitCategories[0],
  };
};

const normalizeKeywordLabel = (label: string) => label.replace(/\s*룩/g, '룩').trim();

const mapKeywordOptions = (items: KeywordItem[]): SearchFilterKeywordOption[] => {
  return items
    .map((item) => ({ id: item.id, label: normalizeKeywordLabel(item.label) }))
    .sort((a, b) => a.id - b.id);
};

const mapFeedbackTagOptions = (items: FeedbackTagItem[]): SearchFilterFeedbackTagOption[] => {
  return items
    .map((item) => ({ id: item.id, label: item.label, voteChoice: item.voteChoice as VoteChoice }))
    .sort((a, b) => a.id - b.id);
};

const mapPostResult = (post: PostSearchItem | ImageSearchItem): ResultCardItem => ({
  key: `post-${post.postId}`,
  postId: post.postId,
  userId: post.userId,
  title: post.content,
  imageUrl: resolveAssetUrl(post.thumbnailUrl),
});

const mapUserResult = (user: UserSearchItem): ResultCardItem => ({
  key: `user-${user.userId}`,
  userId: user.userId,
  title: user.nickname,
  imageUrl: resolveAssetUrl(user.thumbnailUrl),
});

export default function Search() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<SearchMode>('text');
  const [searchType, setSearchType] = useState<SearchType>('ALL');
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recentKeywords, setRecentKeywords] = useState<RecentKeyword[]>([]);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageAssetId, setImageAssetId] = useState<number | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SearchFilterId>('period');
  const [appliedFilters, setAppliedFilters] = useState<SearchFiltersValue>(() =>
    createEmptySearchFilters(),
  );
  const [keywordOptions, setKeywordOptions] = useState<SearchFilterKeywordOption[]>([]);
  const [feedbackTagOptions, setFeedbackTagOptions] = useState<SearchFilterFeedbackTagOption[]>([]);
  const [resultItems, setResultItems] = useState<ResultCardItem[]>([]);
  const [resultCount, setResultCount] = useState(0);
  const [resultLoading, setResultLoading] = useState(false);
  const [resultError, setResultError] = useState('');
  const [textSearchSubmitted, setTextSearchSubmitted] = useState(false);
  const [focusPost, setFocusPost] = useState<FocusPostState | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const isTextMode = mode === 'text';
  const isImageMode = mode === 'image';
  const hasImageResult = Boolean(imagePreviewUrl);

  const currentTypeLabel = useMemo(() => {
    return TYPE_OPTIONS.find((option) => option.value === searchType)?.shortLabel ?? '전체';
  }, [searchType]);

  const reloadTextHistories = useCallback(async () => {
    try {
      const response = await fetchSearchHistories('TEXT');
      const histories = response.items
        .filter((item) => item.searchType === 'TEXT' && item.queryText)
        .map((item) => ({ historyId: item.historyId, query: item.queryText ?? '' }));

      setRecentKeywords(histories);
    } catch {
      setRecentKeywords([]);
    }
  }, []);

  const executeTextSearch = useCallback(
    async (nextQuery = query, nextSearchType = searchType, nextFilters = appliedFilters) => {
      const trimmedQuery = nextQuery.trim();

      if (!trimmedQuery) {
        setResultItems([]);
        setResultCount(0);
        setResultError('');
        setTextSearchSubmitted(false);
        return;
      }

      const apiFilters = buildApiFilters(nextFilters);

      setResultLoading(true);
      setResultError('');
      setTextSearchSubmitted(true);

      try {
        const response = await fetchSearchResults({
          q: trimmedQuery,
          type: nextSearchType,
          limit: SEARCH_LIMIT,
          periodFrom: apiFilters.periodFrom,
          periodTo: apiFilters.periodTo,
          likeRatioMin: apiFilters.likeRatioMin,
          outfitCategories: apiFilters.outfitCategories,
          keywordIds: apiFilters.keywordIds,
          feedbackLikeTagIds: apiFilters.feedbackLikeTagIds,
          feedbackDislikeTagIds: apiFilters.feedbackDislikeTagIds,
        });

        const users = response.users.map(mapUserResult);
        const posts = response.posts.map(mapPostResult);
        const nextItems = nextSearchType === 'NICKNAME' ? users : [...posts, ...users];

        setResultItems(nextItems);
        setResultCount(response.posts.length + response.users.length);
        void reloadTextHistories();
      } catch (error) {
        setResultItems([]);
        setResultCount(0);
        setResultError(getErrorMessage(error, '검색 결과를 불러오지 못했습니다.'));
      } finally {
        setResultLoading(false);
      }
    },
    [appliedFilters, query, reloadTextHistories, searchType],
  );

  const executeImageSearch = useCallback(
    async (nextImageAssetId = imageAssetId, nextFilters = appliedFilters) => {
      if (!nextImageAssetId) {
        setResultItems([]);
        setResultCount(0);
        setResultError('');
        return;
      }

      const apiFilters = buildApiFilters(nextFilters);

      setResultLoading(true);
      setResultError('');

      try {
        const response = await fetchImageSearchResults({
          imageAssetId: nextImageAssetId,
          limit: SEARCH_LIMIT,
          periodFrom: apiFilters.periodFrom,
          periodTo: apiFilters.periodTo,
          likeRatioMin: apiFilters.likeRatioMin,
          keywordIds: apiFilters.keywordIds,
          feedbackLikeTagIds: apiFilters.feedbackLikeTagIds,
          feedbackDislikeTagIds: apiFilters.feedbackDislikeTagIds,
          mode: apiFilters.garmentCategory ? 'SINGLE_ITEM' : undefined,
          garmentCategory: apiFilters.garmentCategory,
        });

        const items = response.items.map(mapPostResult);
        setResultItems(items);
        setResultCount(response.items.length);
      } catch (error) {
        setResultItems([]);
        setResultCount(0);
        setResultError(getErrorMessage(error, '이미지 검색 결과를 불러오지 못했습니다.'));
      } finally {
        setResultLoading(false);
      }
    },
    [appliedFilters, imageAssetId],
  );

  useEffect(() => {
    void reloadTextHistories();

    const loadMasterData = async () => {
      const [keywordResult, feedbackResult] = await Promise.allSettled([
        fetchKeywordOptions(),
        fetchFeedbackTagOptions(),
      ]);

      if (keywordResult.status === 'fulfilled') {
        setKeywordOptions(mapKeywordOptions(keywordResult.value));
      }

      if (feedbackResult.status === 'fulfilled') {
        setFeedbackTagOptions(mapFeedbackTagOptions(feedbackResult.value));
      }
    };

    void loadMasterData();
  }, [reloadTextHistories]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    if (!focusPost) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [focusPost]);

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleChangeMode = (nextMode: SearchMode) => {
    setMode(nextMode);
    setTypeMenuOpen(false);
    setResultError('');

    if (nextMode === 'text') {
      if (!textSearchSubmitted) {
        setResultItems([]);
        setResultCount(0);
      }
      return;
    }

    if (imageAssetId) {
      void executeImageSearch(imageAssetId, appliedFilters);
    } else {
      setResultItems([]);
      setResultCount(0);
    }
  };

  const handleOpenImagePicker = () => {
    fileInputRef.current?.click();
  };

  const handleChangeImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);

    setImagePreviewUrl((previousPreviewUrl) => {
      if (previousPreviewUrl) {
        URL.revokeObjectURL(previousPreviewUrl);
      }

      return nextPreviewUrl;
    });

    setMode('image');
    setImageUploading(true);
    setResultLoading(true);
    setResultError('');
    event.target.value = '';

    try {
      const uploaded = await uploadSearchImage(file);
      setImageAssetId(uploaded.imageAssetId);
      await executeImageSearch(uploaded.imageAssetId, appliedFilters);
    } catch (error) {
      setImageAssetId(null);
      setResultItems([]);
      setResultCount(0);
      setResultError(getErrorMessage(error, '이미지 업로드에 실패했습니다.'));
    } finally {
      setImageUploading(false);
      setResultLoading(false);
    }
  };

  const handleClearQuery = () => {
    setQuery('');
    setTextSearchSubmitted(false);
    setResultItems([]);
    setResultCount(0);
    setResultError('');
  };

  const handleSubmitTextSearch = () => {
    void executeTextSearch(query, searchType, appliedFilters);
  };

  const handleSearchInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSubmitTextSearch();
    }
  };

  const handleRemoveRecentKeyword = async (historyId: number) => {
    setRecentKeywords((previousKeywords) =>
      previousKeywords.filter((keyword) => keyword.historyId !== historyId),
    );

    try {
      await deleteSearchHistory(historyId);
    } catch {
      void reloadTextHistories();
    }
  };

  const handleClearRecentKeywords = async () => {
    const histories = recentKeywords;
    setRecentKeywords([]);

    const results = await Promise.allSettled(
      histories.map((history) => deleteSearchHistory(history.historyId)),
    );

    if (results.some((result) => result.status === 'rejected')) {
      void reloadTextHistories();
    }
  };

  const handleOpenFilter = (filterId: SearchFilterId) => {
    setActiveFilter(filterId);
    setFilterSheetOpen(true);
  };

  const handleCloseFilterSheet = () => {
    setFilterSheetOpen(false);
  };

  const handleApplyFilters = (nextFilters: SearchFiltersValue) => {
    setAppliedFilters(nextFilters);

    if (isTextMode && textSearchSubmitted && query.trim()) {
      void executeTextSearch(query, searchType, nextFilters);
      return;
    }

    if (isImageMode && imageAssetId) {
      void executeImageSearch(imageAssetId, nextFilters);
    }
  };

  const handleSelectSearchType = (nextType: SearchType) => {
    setSearchType(nextType);
    setTypeMenuOpen(false);

    if (textSearchSubmitted && query.trim()) {
      void executeTextSearch(query, nextType, appliedFilters);
    }
  };

  const handleClickResult = (item: ResultCardItem) => {
    if (item.postId) {
      setFocusPost({
        postId: item.postId,
        userId: item.userId,
        title: item.title,
        imageUrl: item.imageUrl,
      });
      setDetailSheetOpen(true);
      return;
    }

    navigate(`/user/${item.userId}/feed`);
  };

  const handleCloseFocus = () => {
    setDetailSheetOpen(false);
    setFocusPost(null);
  };

  const renderResultGrid = () => {
    if (resultLoading || imageUploading) {
      return (
        <div className={styles.resultGrid}>
          {PLACEHOLDER_RESULTS.map((item) => (
            <div key={item} className={styles.resultCard} aria-hidden="true">
              <span className={styles.resultGradient} />
            </div>
          ))}
        </div>
      );
    }

    if (resultError) {
      return <p className={styles.resultErrorText}>{resultError}</p>;
    }

    if (resultItems.length === 0) {
      return <p className={styles.resultEmptyText}>검색 결과가 없어요</p>;
    }

    return (
      <div className={styles.resultGrid}>
        {resultItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={styles.resultCard}
            onClick={() => handleClickResult(item)}
            aria-label={item.title}
          >
            {item.imageUrl ? (
              <img src={item.imageUrl} alt="" className={styles.resultImage} />
            ) : null}
            <span className={styles.resultGradient} />
          </button>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className={styles.page}>
        <Header title="검색" leftAction="back" onBack={handleGoBack} rightAction="menu" />

        <main className={styles.scrollArea}>
          <section className={styles.contentArea}>
            <div className={styles.modeSwitch} role="tablist" aria-label="검색 방식 선택">
              <span
                className={`${styles.modeSwitchThumb} ${
                  isImageMode ? styles.modeSwitchThumbImage : styles.modeSwitchThumbText
                }`}
                aria-hidden="true"
              />

              <button
                type="button"
                role="tab"
                aria-selected={isTextMode}
                className={`${styles.modeButton} ${isTextMode ? styles.modeButtonActive : ''}`}
                onClick={() => handleChangeMode('text')}
              >
                텍스트 검색
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={isImageMode}
                className={`${styles.modeButton} ${isImageMode ? styles.modeButtonActive : ''}`}
                onClick={() => handleChangeMode('image')}
              >
                AI 이미지 검색
              </button>
            </div>

            {isTextMode ? (
              <section className={styles.textSearchSection} aria-label="텍스트 검색 영역">
                <div className={styles.textSearchRow}>
                  <label className={styles.searchInputBox} aria-label="검색어 입력">
                    <button
                      type="button"
                      className={styles.searchInputButton}
                      onClick={handleSubmitTextSearch}
                      aria-label="검색하기"
                    >
                      <SearchIcon size={20} strokeWidth={2.1} />
                    </button>
                    <input
                      className={styles.searchInput}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={handleSearchInputKeyDown}
                      placeholder="검색어를 입력하세요"
                    />
                    <button
                      type="button"
                      className={styles.clearInputButton}
                      onClick={handleClearQuery}
                      aria-label="검색어 지우기"
                    >
                      <X size={20} strokeWidth={2.1} />
                    </button>
                  </label>

                  <div className={styles.scopeWrap}>
                    <button
                      type="button"
                      className={`${styles.filterButton} ${styles.scopeButton}`}
                      onClick={() => setTypeMenuOpen((previous) => !previous)}
                      aria-expanded={typeMenuOpen}
                    >
                      <span>{currentTypeLabel}</span>
                      <ChevronDown size={20} strokeWidth={2.1} />
                    </button>

                    {typeMenuOpen ? (
                      <div className={styles.scopeMenu}>
                        {TYPE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`${styles.scopeOption} ${
                              searchType === option.value ? styles.scopeOptionActive : ''
                            }`}
                            onClick={() => handleSelectSearchType(option.value)}
                          >
                            <span>{option.label}</span>
                            {searchType === option.value ? (
                              <Check size={14} strokeWidth={2.2} />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <FilterScroller
                  filters={FILTERS}
                  appliedFilters={appliedFilters}
                  onOpenFilter={handleOpenFilter}
                />

                <div className={styles.divider} />

                <div className={styles.recentHeaderRow}>
                  <p className={styles.recentTitle}>최근 검색어</p>
                  <button
                    type="button"
                    className={styles.clearAllButton}
                    onClick={handleClearRecentKeywords}
                  >
                    전체 삭제
                  </button>
                </div>

                {recentKeywords.length > 0 ? (
                  <div className={styles.recentChipRow}>
                    {recentKeywords.map((keyword) => (
                      <div key={keyword.historyId} className={styles.recentChip}>
                        <button
                          type="button"
                          className={styles.recentChipTextButton}
                          onClick={() => {
                            setQuery(keyword.query);
                            void executeTextSearch(keyword.query, searchType, appliedFilters);
                          }}
                        >
                          {keyword.query}
                        </button>
                        <button
                          type="button"
                          className={styles.recentChipRemove}
                          onClick={() => handleRemoveRecentKeyword(keyword.historyId)}
                          aria-label={`${keyword.query} 삭제`}
                        >
                          <X size={20} strokeWidth={2.1} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyRecentText}>최근 검색어가 없어요</p>
                )}
              </section>
            ) : (
              <section className={styles.imageSearchSection} aria-label="AI 이미지 검색 영역">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className={styles.fileInput}
                  onChange={handleChangeImage}
                />

                {hasImageResult ? (
                  <div className={styles.imageResultBox}>
                    <div className={styles.uploadedImageWrap}>
                      <img
                        src={imagePreviewUrl ?? ''}
                        alt="업로드한 이미지"
                        className={styles.uploadedImage}
                      />
                    </div>

                    <div className={styles.imageResultCopy}>
                      <p className={styles.imageResultTitle}>비슷한 스타일을 찾았어요</p>
                      <p className={styles.imageResultDescription}>
                        찾으시는 스타일을 확인해보세요
                      </p>
                    </div>

                    <button
                      type="button"
                      className={styles.changeImageButton}
                      onClick={handleOpenImagePicker}
                    >
                      사진 변경
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.imageUploadBox}
                    onClick={handleOpenImagePicker}
                  >
                    <span className={styles.imageUploadInner}>
                      <ImagePlus size={64} strokeWidth={1.7} className={styles.imagePlusIcon} />
                      <span className={styles.imageUploadText}>
                        사진을 업로드하여 원하는
                        <br />
                        코디 스타일을 찾아보세요
                      </span>
                    </span>
                  </button>
                )}

                <FilterScroller
                  filters={FILTERS}
                  appliedFilters={appliedFilters}
                  onOpenFilter={handleOpenFilter}
                />
              </section>
            )}

            <section className={styles.resultSection} aria-label="검색 결과">
              <p className={styles.resultCount}>
                {resultLoading || imageUploading
                  ? '검색 중...'
                  : `검색 결과 ${formatResultCount(resultCount)}개`}
              </p>

              {renderResultGrid()}
            </section>
          </section>

          <div className={styles.footerSpacer} aria-hidden="true" />
        </main>
      </div>

      {filterSheetOpen ? (
        <SearchFilterSheet
          isOpen={filterSheetOpen}
          activeFilter={activeFilter}
          appliedFilters={appliedFilters}
          keywordOptions={keywordOptions}
          feedbackTagOptions={feedbackTagOptions}
          onClose={handleCloseFilterSheet}
          onApply={handleApplyFilters}
        />
      ) : null}

      {focusPost ? (
        <FocusScreen
          isOpen={Boolean(focusPost)}
          items={[{ id: focusPost.postId, imageUrl: focusPost.imageUrl }]}
          activeIndex={0}
          closeButtonType="x"
          onClose={handleCloseFocus}
          sheetOpen={detailSheetOpen}
          onCloseSheet={() => setDetailSheetOpen(false)}
          showSwipeIndicator={false}
          showVoteGraph={false}
          showDetailButton={!detailSheetOpen}
          detailLabel="상세보기"
          onOpenDetail={() => setDetailSheetOpen(true)}
          ariaLabel="게시글 포커스 화면"
        >
          <PostDetailBottomSheet
            isOpen={detailSheetOpen}
            postId={focusPost.postId}
            authorUserId={focusPost.userId}
            onCloseRequest={() => setDetailSheetOpen(false)}
          />
        </FocusScreen>
      ) : null}
    </>
  );
}

type FilterScrollerProps = {
  filters: SearchFilter[];
  appliedFilters: SearchFiltersValue;
  onOpenFilter: (filterId: SearchFilterId) => void;
};

function FilterScroller({ filters, appliedFilters, onOpenFilter }: FilterScrollerProps) {
  return (
    <div className={styles.filterScrollArea} aria-label="검색 필터">
      <div className={styles.filterRow}>
        {filters.map((filter) => {
          const summary = getSearchFilterSummary(appliedFilters, filter.id);
          const hasValue = hasSearchFilterValue(appliedFilters, filter.id);
          const label = summary || filter.label;

          return (
            <button
              key={filter.id}
              type="button"
              className={`${styles.filterButton} ${hasValue ? styles.filterButtonActive : ''}`}
              onClick={() => onOpenFilter(filter.id)}
            >
              <span>{label}</span>
              <ChevronDown size={20} strokeWidth={2.1} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
