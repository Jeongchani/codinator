import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { CalendarDays, Search as SearchIcon, X } from 'lucide-react';
import type { VoteChoice } from '@codinator/contracts';
import styles from './SearchFilterSheet.module.css';

export type SearchFilterId = 'period' | 'likeRatio' | 'outfit' | 'keyword' | 'feedbackTag';

export type PeriodPreset = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

export type PeriodFilterValue = {
  preset: PeriodPreset;
  startDate?: string;
  endDate?: string;
};

export type SelectedKeywordFilter = {
  id: number;
  label: string;
};

export type SelectedFeedbackTagFilter = {
  id: number;
  label: string;
  voteChoice: VoteChoice;
};

export type SearchFiltersValue = {
  period: PeriodFilterValue | null;
  likeRatio: number | null;
  outfits: string[];
  keywords: SelectedKeywordFilter[];
  feedbackTags: SelectedFeedbackTagFilter[];
};

export type SearchFilterKeywordOption = {
  id: number;
  label: string;
};

export type SearchFilterFeedbackTagOption = {
  id: number;
  label: string;
  voteChoice: VoteChoice;
};

type SearchFilterSheetProps = {
  isOpen: boolean;
  activeFilter: SearchFilterId;
  appliedFilters: SearchFiltersValue;
  keywordOptions: SearchFilterKeywordOption[];
  feedbackTagOptions: SearchFilterFeedbackTagOption[];
  onClose: () => void;
  onApply: (filters: SearchFiltersValue) => void;
};

type FilterTab = {
  id: SearchFilterId;
  label: string;
};

type AppliedFilterChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

const FILTER_TABS: FilterTab[] = [
  { id: 'period', label: '기간' },
  { id: 'likeRatio', label: '좋아요 비율' },
  { id: 'outfit', label: '아웃핏' },
  { id: 'keyword', label: '키워드' },
  { id: 'feedbackTag', label: '피드백 태그' },
];

const PERIOD_OPTIONS: Array<{ value: PeriodPreset; label: string }> = [
  { value: 'all', label: '전체 기간' },
  { value: 'today', label: '오늘' },
  { value: 'week', label: '이번 주' },
  { value: 'month', label: '이번 달' },
  { value: 'year', label: '올해' },
];

const LIKE_RATIO_OPTIONS = [25, 50, 75, 100] as const;
const OUTFIT_OPTIONS = ['전체', '아우터', '상의', '하의', '신발', '가방', '악세사리'];

const CLOSE_ANIMATION_MS = 240;

const EMPTY_FILTERS: SearchFiltersValue = {
  period: null,
  likeRatio: null,
  outfits: [],
  keywords: [],
  feedbackTags: [],
};

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const HANGUL_INITIALS = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
];

function getTodayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${date}`;
}

function formatDateLabel(dateValue?: string) {
  if (!dateValue) {
    return '';
  }

  return dateValue.replace(/-/g, '.');
}

function getPeriodLabel(period: PeriodFilterValue | null) {
  if (!period) {
    return '';
  }

  if (period.preset === 'custom') {
    const startDate = formatDateLabel(period.startDate ?? getTodayInputValue());
    const endDate = formatDateLabel(period.endDate ?? getTodayInputValue());
    return `${startDate} ~ ${endDate}`;
  }

  return PERIOD_OPTIONS.find((option) => option.value === period.preset)?.label ?? '';
}

function normalizeKeywordLabel(label: string) {
  return label.replace(/\s*룩/g, '룩').trim();
}

function cloneFilters(filters: SearchFiltersValue): SearchFiltersValue {
  return {
    period: filters.period ? { ...filters.period } : null,
    likeRatio: filters.likeRatio,
    outfits: [...filters.outfits],
    keywords: filters.keywords.map((keyword) => ({ ...keyword })),
    feedbackTags: filters.feedbackTags.map((tag) => ({ ...tag })),
  };
}

function getInitialText(text: string) {
  return Array.from(text)
    .map((char) => {
      const code = char.charCodeAt(0);

      if (code < HANGUL_START || code > HANGUL_END) {
        return char;
      }

      const initialIndex = Math.floor((code - HANGUL_START) / 588);
      return HANGUL_INITIALS[initialIndex] ?? char;
    })
    .join('');
}

function isKeywordMatched(keyword: string, query: string) {
  const normalizedQuery = query.trim().replace(/\s/g, '').toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const normalizedKeyword = keyword.replace(/\s/g, '').toLowerCase();
  const initialText = getInitialText(keyword).replace(/\s/g, '').toLowerCase();

  return normalizedKeyword.includes(normalizedQuery) || initialText.includes(normalizedQuery);
}

function isSelected(list: string[], value: string) {
  return list.includes(value);
}

function toggleStringValue(list: string[], value: string) {
  if (list.includes(value)) {
    return list.filter((item) => item !== value);
  }

  return [...list, value];
}

function toggleKeywordValue(
  list: SelectedKeywordFilter[],
  keyword: SelectedKeywordFilter,
): SelectedKeywordFilter[] {
  if (list.some((item) => item.id === keyword.id)) {
    return list.filter((item) => item.id !== keyword.id);
  }

  return [...list, keyword];
}

function toggleFeedbackTagValue(
  list: SelectedFeedbackTagFilter[],
  tag: SelectedFeedbackTagFilter,
): SelectedFeedbackTagFilter[] {
  if (list.some((item) => item.id === tag.id)) {
    return list.filter((item) => item.id !== tag.id);
  }

  return [...list, tag];
}

export function createEmptySearchFilters(): SearchFiltersValue {
  return cloneFilters(EMPTY_FILTERS);
}

export function getSearchFilterSummary(filters: SearchFiltersValue, filterId: SearchFilterId) {
  if (filterId === 'period') {
    return getPeriodLabel(filters.period);
  }

  if (filterId === 'likeRatio') {
    return filters.likeRatio === null ? '' : `${filters.likeRatio}%`;
  }

  if (filterId === 'outfit') {
    return filters.outfits.length > 0 ? filters.outfits[0] : '';
  }

  if (filterId === 'keyword') {
    return filters.keywords.length > 0 ? filters.keywords[0].label : '';
  }

  if (filterId === 'feedbackTag') {
    return filters.feedbackTags.length > 0 ? filters.feedbackTags[0].label : '';
  }

  return '';
}

export function hasSearchFilterValue(filters: SearchFiltersValue, filterId: SearchFilterId) {
  if (filterId === 'period') {
    return filters.period !== null;
  }

  if (filterId === 'likeRatio') {
    return filters.likeRatio !== null;
  }

  if (filterId === 'outfit') {
    return filters.outfits.length > 0;
  }

  if (filterId === 'keyword') {
    return filters.keywords.length > 0;
  }

  if (filterId === 'feedbackTag') {
    return filters.feedbackTags.length > 0;
  }

  return false;
}

export default function SearchFilterSheet({
  isOpen,
  activeFilter,
  appliedFilters,
  keywordOptions,
  feedbackTagOptions,
  onClose,
  onApply,
}: SearchFilterSheetProps) {
  const [currentFilter, setCurrentFilter] = useState<SearchFilterId>(activeFilter);
  const [draftFilters, setDraftFilters] = useState<SearchFiltersValue>(() => cloneFilters(appliedFilters));
  const [keywordQuery, setKeywordQuery] = useState('');
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isSheetEntered, setIsSheetEntered] = useState(false);
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0 });

  const tabButtonRefs = useRef<Record<SearchFilterId, HTMLButtonElement | null>>({
    period: null,
    likeRatio: null,
    outfit: null,
    keyword: null,
    feedbackTag: null,
  });
  const dragStartYRef = useRef(0);
  const latestDragYRef = useRef(0);
  const closeTimerRef = useRef<number | null>(null);
  const openAnimationFrameRef = useRef<number | null>(null);

  const today = useMemo(() => getTodayInputValue(), []);

  const normalizedKeywordOptions = useMemo(
    () =>
      keywordOptions.map((keyword) => ({
        ...keyword,
        label: normalizeKeywordLabel(keyword.label),
      })),
    [keywordOptions],
  );

  const likeFeedbackTags = useMemo(
    () => feedbackTagOptions.filter((tag) => tag.voteChoice === 'LIKE'),
    [feedbackTagOptions],
  );

  const dislikeFeedbackTags = useMemo(
    () => feedbackTagOptions.filter((tag) => tag.voteChoice === 'DISLIKE'),
    [feedbackTagOptions],
  );

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }

      if (openAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(openAnimationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setCurrentFilter(activeFilter);
    setDraftFilters(cloneFilters(appliedFilters));
    setKeywordQuery('');
    setDragY(0);
    setIsDragging(false);
    setIsClosing(false);
    setIsSheetEntered(false);
    latestDragYRef.current = 0;

    if (openAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(openAnimationFrameRef.current);
    }

    openAnimationFrameRef.current = window.requestAnimationFrame(() => {
      openAnimationFrameRef.current = null;
      setIsSheetEntered(true);
    });
  }, [activeFilter, appliedFilters, isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    const activeButton = tabButtonRefs.current[currentFilter];

    if (!activeButton) {
      return;
    }

    setTabIndicator({
      left: activeButton.offsetLeft,
      width: activeButton.offsetWidth,
    });

    activeButton.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [currentFilter, isOpen]);

  const filteredKeywords = useMemo(
    () => normalizedKeywordOptions.filter((keyword) => isKeywordMatched(keyword.label, keywordQuery)),
    [keywordQuery, normalizedKeywordOptions],
  );

  const appliedFilterChips = useMemo<AppliedFilterChip[]>(() => {
    const chips: AppliedFilterChip[] = [];
    const periodLabel = getPeriodLabel(draftFilters.period);

    if (periodLabel) {
      chips.push({
        id: 'period',
        label: periodLabel,
        onRemove: () => setDraftFilters((previous) => ({ ...previous, period: null })),
      });
    }

    if (draftFilters.likeRatio !== null) {
      chips.push({
        id: 'likeRatio',
        label: `${draftFilters.likeRatio}%`,
        onRemove: () => setDraftFilters((previous) => ({ ...previous, likeRatio: null })),
      });
    }

    draftFilters.outfits.forEach((outfit) => {
      chips.push({
        id: `outfit-${outfit}`,
        label: outfit,
        onRemove: () =>
          setDraftFilters((previous) => ({
            ...previous,
            outfits: previous.outfits.filter((item) => item !== outfit),
          })),
      });
    });

    draftFilters.keywords.forEach((keyword) => {
      chips.push({
        id: `keyword-${keyword.id}`,
        label: keyword.label,
        onRemove: () =>
          setDraftFilters((previous) => ({
            ...previous,
            keywords: previous.keywords.filter((item) => item.id !== keyword.id),
          })),
      });
    });

    draftFilters.feedbackTags.forEach((tag) => {
      chips.push({
        id: `feedback-${tag.id}`,
        label: tag.label,
        onRemove: () =>
          setDraftFilters((previous) => ({
            ...previous,
            feedbackTags: previous.feedbackTags.filter((item) => item.id !== tag.id),
          })),
      });
    });

    return chips;
  }, [draftFilters]);

  if (!isOpen && !isClosing) {
    return null;
  }

  const requestClose = () => {
    if (isClosing) {
      return;
    }

    setIsDragging(false);
    setIsClosing(true);
    setIsSheetEntered(false);

    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
      setIsClosing(false);
      setIsSheetEntered(false);
      setDragY(0);
      latestDragYRef.current = 0;
    }, CLOSE_ANIMATION_MS);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (isClosing) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartYRef.current = event.clientY;
    latestDragYRef.current = 0;
    setIsDragging(true);
    setDragY(0);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextDragY = Math.max(0, moveEvent.clientY - dragStartYRef.current);
      latestDragYRef.current = nextDragY;
      setDragY(nextDragY);
    };

    const stopDragging = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', stopDragging);
      document.removeEventListener('pointercancel', stopDragging);

      const finalDragY = latestDragYRef.current;
      setIsDragging(false);

      if (finalDragY > 72) {
        requestClose();
        return;
      }

      latestDragYRef.current = 0;
      setDragY(0);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', stopDragging);
    document.addEventListener('pointercancel', stopDragging);
  };

  const handleSelectPeriodPreset = (preset: PeriodPreset) => {
    setDraftFilters((previous) => ({
      ...previous,
      period: preset === 'custom' ? { preset: 'custom', startDate: today, endDate: today } : { preset },
    }));
  };

  const handleChangePeriodStartDate = (startDate: string) => {
    setDraftFilters((previous) => {
      const previousEndDate = previous.period?.preset === 'custom' ? previous.period.endDate ?? today : today;
      const nextEndDate = previousEndDate < startDate ? startDate : previousEndDate;

      return {
        ...previous,
        period: {
          preset: 'custom',
          startDate,
          endDate: nextEndDate,
        },
      };
    });
  };

  const handleChangePeriodEndDate = (endDate: string) => {
    setDraftFilters((previous) => {
      const previousStartDate = previous.period?.preset === 'custom' ? previous.period.startDate ?? today : today;
      const nextStartDate = previousStartDate > endDate ? endDate : previousStartDate;

      return {
        ...previous,
        period: {
          preset: 'custom',
          startDate: nextStartDate,
          endDate,
        },
      };
    });
  };

  const handleSelectLikeRatio = (value: number) => {
    setDraftFilters((previous) => ({
      ...previous,
      likeRatio: value,
    }));
  };

  const handleChangeLikeRatio = (value: string) => {
    setDraftFilters((previous) => ({
      ...previous,
      likeRatio: Number(value),
    }));
  };

  const handleSelectOutfit = (outfit: string) => {
    setDraftFilters((previous) => {
      if (outfit === '전체') {
        return { ...previous, outfits: [] };
      }

      return { ...previous, outfits: toggleStringValue(previous.outfits, outfit) };
    });
  };

  const handleSelectKeyword = (keyword: SearchFilterKeywordOption) => {
    setDraftFilters((previous) => ({
      ...previous,
      keywords: toggleKeywordValue(previous.keywords, keyword),
    }));
  };

  const handleSelectFeedbackTag = (tag: SearchFilterFeedbackTagOption) => {
    setDraftFilters((previous) => ({
      ...previous,
      feedbackTags: toggleFeedbackTagValue(previous.feedbackTags, tag),
    }));
  };

  const handleReset = () => {
    setDraftFilters(createEmptySearchFilters());
    setKeywordQuery('');
  };

  const handleApply = () => {
    onApply(cloneFilters(draftFilters));
    requestClose();
  };

  const periodPreset = draftFilters.period?.preset ?? null;
  const periodStartDate = draftFilters.period?.preset === 'custom' ? draftFilters.period.startDate ?? today : today;
  const periodEndDate = draftFilters.period?.preset === 'custom' ? draftFilters.period.endDate ?? today : today;
  const likeRatioValue = draftFilters.likeRatio ?? 50;

  return (
    <div className={styles.overlay}>
      <button
        type="button"
        className={`${styles.backdrop} ${isClosing ? styles.backdropClosing : ''}`}
        onClick={() => requestClose()}
        aria-label="필터 바텀시트 닫기"
      />
      <section
        className={`${styles.sheet} ${isDragging ? styles.sheetDragging : ''}`}
        style={
          {
            transform: isClosing || !isSheetEntered ? 'translateY(100%)' : `translateY(${dragY}px)`,
          } as CSSProperties
        }
        aria-label="검색 필터 바텀시트"
      >
        <div className={styles.dragArea} onPointerDown={handlePointerDown}>
          <span className={styles.dragHandle} />
        </div>

        <div className={styles.tabScrollArea} aria-label="필터 종류">
          <div className={styles.tabRow}>
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                ref={(element) => {
                  tabButtonRefs.current[tab.id] = element;
                }}
                type="button"
                className={`${styles.tabButton} ${currentFilter === tab.id ? styles.tabButtonActive : ''}`}
                onClick={() => setCurrentFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
            <span
              className={styles.tabIndicator}
              style={{ transform: `translateX(${tabIndicator.left}px)`, width: tabIndicator.width }}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className={styles.sheetContent}>
          {currentFilter === 'period' ? (
            <div className={styles.filterPanel}>
              <div className={styles.optionRowSingleLine}>
                {PERIOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.optionChip} ${periodPreset === option.value ? styles.optionChipActive : ''}`}
                    onClick={() => handleSelectPeriodPreset(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className={styles.detailBlock}>
                <p className={styles.detailTitle}>기간 설정</p>

                <div className={styles.dateRangeBox}>
                  <label className={styles.dateBox}>
                    <CalendarDays size={18} strokeWidth={2} className={styles.dateIcon} />
                    <input
                      className={styles.dateInput}
                      type="date"
                      max={periodEndDate || today}
                      value={periodStartDate}
                      onChange={(event) => handleChangePeriodStartDate(event.target.value)}
                      aria-label="시작 날짜"
                    />
                  </label>
                  <span className={styles.dateDash}>~</span>
                  <label className={styles.dateBox}>
                    <CalendarDays size={18} strokeWidth={2} className={styles.dateIcon} />
                    <input
                      className={styles.dateInput}
                      type="date"
                      min={periodStartDate}
                      max={today}
                      value={periodEndDate}
                      onChange={(event) => handleChangePeriodEndDate(event.target.value)}
                      aria-label="끝 날짜"
                    />
                  </label>
                </div>
              </div>
            </div>
          ) : null}

          {currentFilter === 'likeRatio' ? (
            <div className={styles.filterPanel}>
              <div className={styles.optionRowSingleLine}>
                {LIKE_RATIO_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`${styles.optionChip} ${draftFilters.likeRatio === option ? styles.optionChipActive : ''}`}
                    onClick={() => handleSelectLikeRatio(option)}
                  >
                    {`${option}%`}
                  </button>
                ))}
              </div>

              <div className={styles.detailBlock}>
                <p className={styles.detailTitle}>좋아요 비율</p>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={likeRatioValue}
                  onChange={(event) => handleChangeLikeRatio(event.target.value)}
                  className={styles.rangeInput}
                  aria-label="좋아요 비율 조절"
                />

                <div className={styles.rangeLabelRow}>
                  <span>0%</span>
                  <span>{likeRatioValue}%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          ) : null}

          {currentFilter === 'outfit' ? (
            <div className={styles.filterPanel}>
              <div className={styles.optionRowMultiline}>
                {OUTFIT_OPTIONS.map((outfit) => {
                  const active = outfit === '전체' ? draftFilters.outfits.length === 0 : isSelected(draftFilters.outfits, outfit);

                  return (
                    <button
                      key={outfit}
                      type="button"
                      className={`${styles.optionChip} ${active ? styles.optionChipActive : ''}`}
                      onClick={() => handleSelectOutfit(outfit)}
                    >
                      {outfit}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {currentFilter === 'keyword' ? (
            <div className={styles.filterPanel}>
              <label className={styles.keywordSearchBox}>
                <SearchIcon size={20} strokeWidth={2.1} className={styles.keywordSearchIcon} />
                <input
                  value={keywordQuery}
                  onChange={(event) => setKeywordQuery(event.target.value)}
                  className={styles.keywordInput}
                  placeholder="키워드 검색"
                />
              </label>

              <div className={styles.optionRowMultiline}>
                {filteredKeywords.map((keyword) => (
                  <button
                    key={keyword.id}
                    type="button"
                    className={`${styles.optionChip} ${draftFilters.keywords.some((item) => item.id === keyword.id) ? styles.optionChipActive : ''}`}
                    onClick={() => handleSelectKeyword(keyword)}
                  >
                    {keyword.label}
                  </button>
                ))}
              </div>

              {filteredKeywords.length === 0 ? <p className={styles.emptyText}>일치하는 키워드가 없어요</p> : null}
            </div>
          ) : null}

          {currentFilter === 'feedbackTag' ? (
            <div className={styles.filterPanel}>
              <div className={styles.feedbackSection}>
                <p className={styles.feedbackTitle}>좋아요</p>
                <div className={styles.feedbackDivider} />
                <div className={styles.feedbackTagGrid}>
                  {likeFeedbackTags.map((tag) => (
                    <button
                      key={`like-${tag.id}`}
                      type="button"
                      className={`${styles.optionChip} ${draftFilters.feedbackTags.some((item) => item.id === tag.id) ? styles.optionChipActive : ''}`}
                      onClick={() => handleSelectFeedbackTag(tag)}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
                {likeFeedbackTags.length === 0 ? <p className={styles.emptyText}>좋아요 태그가 없어요</p> : null}
              </div>

              <div className={styles.feedbackSection}>
                <p className={styles.feedbackTitle}>싫어요</p>
                <div className={styles.feedbackDivider} />
                <div className={styles.feedbackTagGrid}>
                  {dislikeFeedbackTags.map((tag) => (
                    <button
                      key={`dislike-${tag.id}`}
                      type="button"
                      className={`${styles.optionChip} ${draftFilters.feedbackTags.some((item) => item.id === tag.id) ? styles.optionChipActive : ''}`}
                      onClick={() => handleSelectFeedbackTag(tag)}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
                {dislikeFeedbackTags.length === 0 ? <p className={styles.emptyText}>싫어요 태그가 없어요</p> : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.appliedArea}>
          <div className={styles.appliedDivider} />
          <p className={styles.appliedTitle}>적용된 필터</p>

          {appliedFilterChips.length > 0 ? (
            <div className={styles.appliedChipRow}>
              {appliedFilterChips.map((chip) => (
                <button key={chip.id} type="button" className={styles.appliedChip} onClick={chip.onRemove}>
                  <span>{chip.label}</span>
                  <X size={18} strokeWidth={2.1} />
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.emptyAppliedText}>적용된 필터가 없어요</p>
          )}

          <div className={styles.actionRow}>
            <button type="button" className={styles.resetButton} onClick={handleReset}>
              초기화
            </button>
            <button type="button" className={styles.applyButton} onClick={handleApply}>
              적용하기
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
