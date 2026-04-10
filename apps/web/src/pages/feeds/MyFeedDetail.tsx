import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  Plus,
  SquarePen,
  Tag,
  Trash2,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type {
  GarmentCategory,
  GetFeedPostDetailResponse,
  UpdatePostResponse,
} from '@codinator/contracts';
import {
  clearAuthTokens,
  fetcher,
  getAuthHeaders,
  getPrimaryPostImageUrl,
  resolveAssetUrl,
} from '../../lib/api';
import styles from './MyFeedDetail.module.css';

type RouteParams = {
  postId?: string;
};

type PreviewPost = {
  id?: number;
  postId?: number;
  imageUrl?: string;
  nickname?: string;
  content?: string;
};

type LocationState = {
  post?: PreviewPost;
};

type StructuredFeedbackRow = {
  tagId: number;
  label: string;
  count: number;
  percent: number;
  side: 'LIKE' | 'DISLIKE';
};

type WearType =
  | ''
  | '상의'
  | '하의'
  | '아우터'
  | '신발'
  | '가방'
  | '악세사리'
  | '기타';

type EditableWearItem = {
  id: number;
  type: WearType;
  brand: string;
  name: string;
};

const wearTypeOptions: WearType[] = [
  '',
  '상의',
  '하의',
  '아우터',
  '신발',
  '가방',
  '악세사리',
  '기타',
];

function cls(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toSafeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toSafeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
}

function normalizeVoteChoice(value: unknown): 'LIKE' | 'DISLIKE' | undefined {
  const text = String(value ?? '').toUpperCase();

  if (
    text.includes('LIKE') &&
    !text.includes('DISLIKE') &&
    !text.includes('UNLIKE')
  ) {
    return 'LIKE';
  }

  if (text.includes('DISLIKE') || text.includes('NEGATIVE')) {
    return 'DISLIKE';
  }

  return undefined;
}

function formatCount(value: number) {
  return Math.max(0, value).toLocaleString('ko-KR');
}

function formatKeywordLabel(keyword: string) {
  return keyword.startsWith('#') ? keyword : `#${keyword}`;
}

function formatDate(value?: string) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function decodeJwtPayload(token: string): Record<string, unknown> | undefined {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return undefined;

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    );

    const decoded = atob(padded);
    const json = decodeURIComponent(
      Array.from(decoded)
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );

    const parsed: unknown = JSON.parse(json);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function getStoredAccessToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  return (
    window.localStorage.getItem('accessToken') ??
    window.localStorage.getItem('token') ??
    undefined
  );
}

function getCurrentUserId(): number | undefined {
  if (typeof window === 'undefined') return undefined;

  const rawCandidates = [
    window.localStorage.getItem('userId'),
    window.localStorage.getItem('id'),
    window.localStorage.getItem('memberId'),
  ];

  for (const raw of rawCandidates) {
    const parsed = toSafeNumber(raw);
    if (parsed !== undefined) return parsed;
  }

  const token = getStoredAccessToken();
  if (!token) return undefined;

  const payload = decodeJwtPayload(token);
  if (!payload) return undefined;

  return (
    toSafeNumber(payload.userId) ??
    toSafeNumber(payload.memberId) ??
    toSafeNumber(payload.id) ??
    toSafeNumber(payload.sub)
  );
}

function formatCategoryLabel(value: unknown) {
  const raw = toSafeString(value);
  if (!raw) return '의류 종류 미등록';

  const key = raw.trim().toUpperCase();

  const categoryMap: Record<string, string> = {
    TOP: '상의',
    TOPS: '상의',
    SHIRT: '상의',
    TSHIRT: '상의',
    T_SHIRT: '상의',
    BLOUSE: '상의',
    KNIT: '상의',
    SWEATSHIRT: '상의',

    BOTTOM: '하의',
    BOTTOMS: '하의',
    PANTS: '하의',
    SKIRT: '하의',
    JEANS: '하의',
    SHORTS: '하의',

    OUTER: '아우터',
    JACKET: '아우터',
    COAT: '아우터',
    CARDIGAN: '아우터',
    HOODIE: '아우터',

    DRESS: '원피스',
    ONEPIECE: '원피스',
    ONE_PIECE: '원피스',

    SHOES: '신발',
    SNEAKERS: '신발',
    BOOTS: '신발',

    BAG: '가방',
    BAGS: '가방',

    ACCESSORY: '액세서리',
    ACCESSORIES: '액세서리',
    ACC: '액세서리',
    HAT: '모자',
    CAP: '모자',
    ETC: '기타',
  };

  return categoryMap[key] ?? raw;
}

function mapCategoryToWearType(value: unknown): WearType {
  const raw = toSafeString(value);
  if (!raw) return '';

  const key = raw.trim().toUpperCase();

  const categoryMap: Record<string, WearType> = {
    TOP: '상의',
    TOPS: '상의',
    SHIRT: '상의',
    TSHIRT: '상의',
    T_SHIRT: '상의',
    BLOUSE: '상의',
    KNIT: '상의',
    SWEATSHIRT: '상의',

    BOTTOM: '하의',
    BOTTOMS: '하의',
    PANTS: '하의',
    SKIRT: '하의',
    JEANS: '하의',
    SHORTS: '하의',

    OUTER: '아우터',
    JACKET: '아우터',
    COAT: '아우터',
    CARDIGAN: '아우터',
    HOODIE: '아우터',

    SHOES: '신발',
    SNEAKERS: '신발',
    BOOTS: '신발',

    BAG: '가방',
    BAGS: '가방',

    ACCESSORY: '악세사리',
    ACCESSORIES: '악세사리',
    ACC: '악세사리',

    ETC: '기타',
  };

  return categoryMap[key] ?? '';
}

function mapWearTypeToCategory(type: WearType): GarmentCategory | null {
  switch (type) {
    case '상의':
      return 'TOP';
    case '하의':
      return 'BOTTOM';
    case '아우터':
      return 'OUTER';
    case '신발':
      return 'SHOES';
    case '가방':
      return 'BAG';
    case '악세사리':
      return 'ACCESSORY';
    case '기타':
      return 'ETC';
    default:
      return null;
  }
}

function extractKeywordLabels(data: GetFeedPostDetailResponse | null): string[] {
  if (!data) return [];

  const raw = data as unknown as Record<string, unknown>;
  const candidates = [
    raw.keywords,
    raw.keywordLabels,
    raw.tags,
    raw.postKeywords,
  ];

  const labels: string[] = [];

  candidates.forEach((candidate) => {
    if (!Array.isArray(candidate)) return;

    candidate.forEach((item) => {
      if (typeof item === 'string' && item.trim()) {
        labels.push(item.trim());
        return;
      }

      if (isRecord(item)) {
        const label =
          toSafeString(item.label) ??
          toSafeString(item.name) ??
          toSafeString(item.keyword) ??
          toSafeString(item.keywordLabel);

        if (label) labels.push(label);
      }
    });
  });

  return [...new Set(labels)].slice(0, 5);
}

function extractStructuredFeedback(data: GetFeedPostDetailResponse | null): {
  likeRows: StructuredFeedbackRow[];
  dislikeRows: StructuredFeedbackRow[];
  likeTotalCount: number;
  dislikeTotalCount: number;
} {
  if (!data) {
    return {
      likeRows: [],
      dislikeRows: [],
      likeTotalCount: 0,
      dislikeTotalCount: 0,
    };
  }

  const raw = data as unknown as Record<string, unknown>;
  const feedbackSummary = Array.isArray(raw.feedbackSummary)
    ? raw.feedbackSummary
    : [];

  const parsedRows = feedbackSummary
    .map((item) => {
      if (!isRecord(item)) return null;

      const label =
        toSafeString(item.label) ??
        toSafeString(item.name) ??
        toSafeString(item.keyword) ??
        toSafeString(item.feedbackLabel);

      const voteChoice =
        normalizeVoteChoice(item.voteChoice) ??
        normalizeVoteChoice(item.side) ??
        normalizeVoteChoice(item.type);

      const count =
        toSafeNumber(item.count) ??
        toSafeNumber(item.totalCount) ??
        toSafeNumber(item.voteCount) ??
        0;

      if (!label || !voteChoice || count <= 0) return null;

      return {
        tagId: toSafeNumber(item.tagId) ?? count,
        label,
        count,
        side: voteChoice,
      };
    })
    .filter(
      (
        item,
      ): item is {
        tagId: number;
        label: string;
        count: number;
        side: 'LIKE' | 'DISLIKE';
      } => Boolean(item),
    );

  const likeList = parsedRows
    .filter((item) => item.side === 'LIKE')
    .sort((a, b) => b.count - a.count);

  const dislikeList = parsedRows
    .filter((item) => item.side === 'DISLIKE')
    .sort((a, b) => b.count - a.count);

  const likeTotal = likeList.reduce((sum, item) => sum + item.count, 0);
  const dislikeTotal = dislikeList.reduce((sum, item) => sum + item.count, 0);

  const likeRows: StructuredFeedbackRow[] = likeList.slice(0, 5).map((item) => ({
    ...item,
    percent: likeTotal > 0 ? Math.round((item.count / likeTotal) * 100) : 0,
  }));

  const dislikeRows: StructuredFeedbackRow[] = dislikeList.slice(0, 5).map((item) => ({
    ...item,
    percent: dislikeTotal > 0 ? Math.round((item.count / dislikeTotal) * 100) : 0,
  }));

  return {
    likeRows,
    dislikeRows,
    likeTotalCount: likeTotal,
    dislikeTotalCount: dislikeTotal,
  };
}

function buildEditableWearItems(source: unknown): EditableWearItem[] {
  const items = Array.isArray(source) ? source : [];

  return items.map((item, index) => {
    const record = isRecord(item) ? item : null;

    return {
      id: toSafeNumber(record?.id) ?? index + 1,
      type: mapCategoryToWearType(record?.category),
      brand: toSafeString(record?.brand) ?? '',
      name:
        toSafeString(record?.itemName) ??
        toSafeString(record?.name) ??
        '',
    };
  });
}

function normalizeEditableWearItem(item: EditableWearItem) {
  return {
    type: item.type,
    brand: item.brand.trim(),
    name: item.name.trim(),
  };
}

function isSavableWearItem(item: EditableWearItem) {
  const normalizedItem = normalizeEditableWearItem(item);

  return (
    mapWearTypeToCategory(normalizedItem.type) !== null &&
    Boolean(normalizedItem.brand || normalizedItem.name)
  );
}


type FeedbackPanelProps = {
  title: string;
  side: 'LIKE' | 'DISLIKE';
  count: number;
  rows: StructuredFeedbackRow[];
};

function FeedbackPanel({ title, side, count, rows }: FeedbackPanelProps) {
  return (
    <div className={styles.feedbackPanel}>
      <div className={styles.feedbackPanelHeader}>
        <h4 className={styles.feedbackPanelTitle}>{title}</h4>
        <span className={styles.feedbackPanelCount}>{formatCount(count)}표 받음</span>
      </div>

      <div className={styles.feedbackRows}>
        {rows.length > 0 ? (
          rows.map((row) => (
            <div key={`${side}-${row.tagId}-${row.label}`} className={styles.feedbackRow}>
              <div className={styles.feedbackRowHead}>
                <span className={styles.feedbackRowLabel}>{row.label}</span>
                <span className={styles.feedbackRowPercent}>{row.percent}%</span>
              </div>

              <div className={styles.feedbackRowTrack}>
                <div
                  className={`${styles.feedbackRowFill} ${
                    side === 'LIKE'
                      ? styles.feedbackRowFillLike
                      : styles.feedbackRowFillDislike
                  }`}
                  style={{ width: `${Math.max(row.percent, 6)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className={styles.feedbackEmptyText}>아직 피드백이 없습니다.</p>
        )}
      </div>
    </div>
  );
}

function WearTypeDropdown({
  value,
  options,
  open,
  onToggle,
  onClose,
  onChange,
  disabled = false,
}: {
  value: WearType;
  options: WearType[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (value: WearType) => void;
  disabled?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (wrapRef.current && !wrapRef.current.contains(target)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  return (
    <div className={styles.selectWrap} ref={wrapRef}>
      <button
        type="button"
        className={cls(styles.itemSelectButton, open && styles.itemSelectButtonOpen)}
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <div className={styles.itemSelectContent}>
          <Tag size={14} strokeWidth={2.1} className={styles.itemSelectTagIcon} />
          <span
            className={cls(
              styles.itemSelectText,
              !value && styles.itemSelectPlaceholder,
            )}
          >
            {value || '의류 종류 선택'}
          </span>
        </div>

        <ChevronDown
          size={16}
          strokeWidth={2.2}
          className={cls(styles.itemSelectChevron, open && styles.itemSelectChevronOpen)}
        />
      </button>

      {open && (
        <div className={styles.selectMenu} role="listbox">
          {options.map((type) => {
            const isPlaceholder = type === '';
            const selected = value === type;

            return (
              <button
                key={type || 'placeholder'}
                type="button"
                className={cls(
                  styles.selectOption,
                  selected && styles.selectOptionActive,
                  isPlaceholder && styles.selectOptionPlaceholder,
                )}
                onClick={() => {
                  onChange(type);
                  onClose();
                }}
              >
                <div className={styles.selectOptionContent}>
                  <Tag size={14} strokeWidth={2.1} className={styles.selectOptionTagIcon} />
                  <span className={styles.selectOptionLabel}>
                    {type || '의류 종류 선택'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const MyFeedDetail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { postId } = useParams<RouteParams>();

  const locationState = location.state as LocationState | undefined;
  const previewPost = locationState?.post;

  const resolvedPostId =
    toSafeNumber(postId) ?? previewPost?.id ?? previewPost?.postId;

  const currentUserId = useMemo(() => getCurrentUserId(), []);

  const [data, setData] = useState<GetFeedPostDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState('');

  const [isEditingOutfit, setIsEditingOutfit] = useState(false);
  const [editableWearItems, setEditableWearItems] = useState<EditableWearItem[]>([]);
  const [initialWearItems, setInitialWearItems] = useState<EditableWearItem[]>([]);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [outfitSaving, setOutfitSaving] = useState(false);
  const [outfitError, setOutfitError] = useState('');
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<Set<number>>(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const handleAuthError = useCallback(
    (message: string) => {
      if (
        message.includes('Unauthorized') ||
        message.includes('로그인이 필요합니다') ||
        message.includes('401') ||
        message.includes('유효하지 않거나 만료된 토큰')
      ) {
        clearAuthTokens();
        navigate('/login', { replace: true });
        return true;
      }

      return false;
    },
    [navigate],
  );

  const loadDetail = useCallback(async () => {
    if (!resolvedPostId) {
      setDetailError('게시글 정보가 없습니다.');
      setDetailLoading(false);
      return;
    }

    try {
      setDetailLoading(true);
      setDetailError('');

      const endpointCandidates = [
        `/users/me/feed/${resolvedPostId}`,
        currentUserId ? `/users/${currentUserId}/feed/${resolvedPostId}` : null,
      ].filter((value): value is string => Boolean(value));

      let loaded = false;
      let lastMessage = '피드 상세를 불러오지 못했습니다.';

      for (const endpoint of endpointCandidates) {
        try {
          const response = await fetcher<GetFeedPostDetailResponse>(endpoint, {
            headers: getAuthHeaders(),
          });

          setData(response);
          loaded = true;
          break;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : '피드 상세를 불러오지 못했습니다.';

          lastMessage = message;

          if (handleAuthError(message)) {
            return;
          }

          const isNotFound =
            message.includes('404') ||
            message.includes('Not Found') ||
            message.includes('찾을 수 없습니다');

          if (!isNotFound) {
            break;
          }
        }
      }

      if (!loaded) {
        setDetailError(lastMessage);
      }
    } finally {
      setDetailLoading(false);
    }
  }, [currentUserId, handleAuthError, resolvedPostId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const likeCount = data?.voteSummary.likeCount ?? 0;
  const dislikeCount = data?.voteSummary.dislikeCount ?? 0;
  const totalVoteCount = likeCount + dislikeCount;

  const likePercent = useMemo(() => {
    if (totalVoteCount <= 0) return 0;
    return Math.round((likeCount / totalVoteCount) * 100);
  }, [likeCount, totalVoteCount]);

  const dislikePercent = useMemo(() => {
    if (totalVoteCount <= 0) return 0;
    return 100 - likePercent;
  }, [likePercent, totalVoteCount]);

  const keywordChips = useMemo(() => extractKeywordLabels(data), [data]);
  const structuredFeedback = useMemo(() => extractStructuredFeedback(data), [data]);

  const dataRecord = data as unknown as Record<string, unknown> | null;
  const authorRecord = dataRecord && isRecord(dataRecord.author) ? dataRecord.author : null;

  const titleText =
    toSafeString(authorRecord?.nickname) ??
    toSafeString(previewPost?.nickname) ??
    '내 피드';

  const createdAtText = formatDate(toSafeString(dataRecord?.createdAt));
  const postDisplayText =
    data?.content ?? previewPost?.content ?? '코디 설명이 없습니다.';

  const imageUrl = data?.images?.length
    ? getPrimaryPostImageUrl(data)
    : previewPost?.imageUrl
      ? resolveAssetUrl(previewPost.imageUrl)
      : undefined;

  const outfitItems = Array.isArray(data?.outfitItems) ? data.outfitItems : [];

  const changeSummary = useMemo(() => {
    const initialItemMap = new Map(
      initialWearItems.map((item) => [item.id, normalizeEditableWearItem(item)]),
    );

    let addedCount = 0;
    let modifiedCount = 0;
    let deletedCount = 0;

    editableWearItems.forEach((item) => {
      const currentItem = normalizeEditableWearItem(item);
      const initialItem = initialItemMap.get(item.id);
      if (!initialItem) {
        if (!selectedDeleteIds.has(item.id) && isSavableWearItem(item)) {
          addedCount += 1;
        }
        return;
      }

      const hadInitialValue = Boolean(
        initialItem.type || initialItem.brand || initialItem.name,
      );

      if (selectedDeleteIds.has(item.id)) {
        if (hadInitialValue) {
          deletedCount += 1;
        }
        return;
      }

      if (!hadInitialValue) {
        return;
      }

      const changed =
        currentItem.type !== initialItem.type ||
        currentItem.brand !== initialItem.brand ||
        currentItem.name !== initialItem.name;

      if (changed) {
        modifiedCount += 1;
      }
    });

    return {
      addedCount,
      modifiedCount,
      deletedCount,
    };
  }, [editableWearItems, initialWearItems, selectedDeleteIds]);

  const handleStartOutfitEdit = () => {
    const existingItems = buildEditableWearItems(outfitItems);
    const nextId =
      existingItems.length > 0
        ? Math.max(...existingItems.map((item) => item.id)) + 1
        : 1;

    const nextItems: EditableWearItem[] = [
      ...existingItems,
      {
        id: nextId,
        type: '',
        brand: '',
        name: '',
      },
    ];

    setEditableWearItems(nextItems);
    setInitialWearItems(existingItems.map((item) => ({ ...item })));
    setOpenDropdownId(null);
    setOutfitError('');
    setDeleteMode(false);
    setSelectedDeleteIds(new Set());
    setConfirmDeleteOpen(false);
    setIsEditingOutfit(true);
  };

  const handleCancelOutfitEdit = () => {
    setIsEditingOutfit(false);
    setEditableWearItems([]);
    setInitialWearItems([]);
    setOpenDropdownId(null);
    setOutfitError('');
    setDeleteMode(false);
    setSelectedDeleteIds(new Set());
    setConfirmDeleteOpen(false);
  };

  const handleWearItemChange = (
    itemId: number,
    field: keyof Pick<EditableWearItem, 'type' | 'brand' | 'name'>,
    value: string,
  ) => {
    setEditableWearItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  };

  const handleAddWearItem = () => {
    setEditableWearItems((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((item) => item.id)) + 1 : 1;

      return [
        ...prev,
        {
          id: nextId,
          type: '',
          brand: '',
          name: '',
        },
      ];
    });

    setOpenDropdownId(null);
    setDeleteMode(false);
    setSelectedDeleteIds(new Set());
    setConfirmDeleteOpen(false);
  };

  const handleToggleDeleteMode = () => {
    if (!deleteMode) {
      setDeleteMode(true);
      setSelectedDeleteIds(new Set());
      setOpenDropdownId(null);
      setConfirmDeleteOpen(false);
      return;
    }

    setDeleteMode(false);
    setSelectedDeleteIds(new Set());
    setConfirmDeleteOpen(false);
  };

  const handleCloseDeleteConfirm = () => {
    if (outfitSaving) return;
    setConfirmDeleteOpen(false);
  };

  const handleToggleDeleteSelection = (itemId: number) => {
    if (!deleteMode) return;

    setSelectedDeleteIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const saveOutfitItems = async (items: EditableWearItem[]) => {
    if (!resolvedPostId || outfitSaving || !data) return;

    try {
      setOutfitSaving(true);
      setOutfitError('');

      const payloadOutfitItems = items
        .map((item) => ({
          category: mapWearTypeToCategory(item.type),
          brand: item.brand.trim() || null,
          itemName: item.name.trim() || null,
        }))
        .filter(
          (
            item,
          ): item is {
            category: GarmentCategory;
            brand: string | null;
            itemName: string | null;
          } => item.category !== null && Boolean(item.brand || item.itemName),
        );

      await fetcher<UpdatePostResponse>(`/posts/${resolvedPostId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          outfitItems: payloadOutfitItems,
        }),
      });

      await loadDetail();
      setIsEditingOutfit(false);
      setEditableWearItems([]);
      setInitialWearItems([]);
      setOpenDropdownId(null);
      setDeleteMode(false);
      setSelectedDeleteIds(new Set());
      setConfirmDeleteOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : '착용 아이템 수정에 실패했습니다.';
      setOutfitError(message);
      handleAuthError(message);
    } finally {
      setOutfitSaving(false);
    }
  };

  const handleConfirmOutfitUpdate = async () => {
    const nextItems = editableWearItems.filter((item) => !selectedDeleteIds.has(item.id));
    await saveOutfitItems(nextItems);
  };

  const handleCompleteOutfitEdit = () => {
    if (!resolvedPostId || outfitSaving || !data) return;
    setConfirmDeleteOpen(true);
  };

  if (detailLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.scrollArea}>
          <div className={styles.loadingBox}>상세 정보를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.container}>
        <div className={styles.scrollArea}>
          <div className={styles.loadingBox}>
            {detailError || '피드 상세를 불러올 수 없습니다.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>
        <section className={styles.heroSection}>
          <div className={styles.heroMediaFrame}>
            {imageUrl ? (
              <img src={imageUrl} alt="내 피드 이미지" className={styles.heroImage} />
            ) : (
              <div className={styles.heroPlaceholder}>
                <span className={styles.heroPlaceholderText}>이미지가 없습니다.</span>
              </div>
            )}

            <button
              type="button"
              className={styles.backButton}
              onClick={() => navigate(-1)}
              aria-label="뒤로가기"
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
            </button>
          </div>
        </section>

        <div className={styles.contentPanel}>
          <div className={styles.sheetHeader}>
            <div className={styles.sheetHeaderCopy}>
              <div className={styles.titleRow}>
                <h1 className={styles.mainTitle}>{titleText}</h1>
              </div>

              {createdAtText ? <p className={styles.dateText}>{createdAtText}</p> : null}

              <p className={styles.contentText}>{postDisplayText}</p>
            </div>
          </div>

          {keywordChips.length > 0 && (
            <div className={styles.keywordLaneSection}>
              <div className={styles.keywordLane}>
                {keywordChips.map((keyword) => (
                  <span key={keyword} className={styles.keywordChip}>
                    {formatKeywordLabel(keyword)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className={styles.sectionDivider} />

          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeaderRow}>
              <h3 className={styles.sectionTitle}>평가</h3>
              <span className={styles.sectionMetaText}>{formatCount(totalVoteCount)}명 참여</span>
            </div>

            <div className={styles.evaluationSummaryRow}>
              <div className={`${styles.evaluationSummaryItem} ${styles.evaluationSummaryLike}`}>
                <ThumbsUp size={13} strokeWidth={2.2} />
                <span>{likePercent}%</span>
              </div>

              <div
                className={`${styles.evaluationSummaryItem} ${styles.evaluationSummaryDislike}`}
              >
                <ThumbsDown size={13} strokeWidth={2.2} />
                <span>{dislikePercent}%</span>
              </div>
            </div>

            <div className={styles.evaluationTrack}>
              <div className={styles.evaluationLikeFill} style={{ width: `${likePercent}%` }} />
              <div
                className={styles.evaluationDislikeFill}
                style={{ width: `${dislikePercent}%` }}
              />
            </div>
          </section>

          <div className={styles.sectionDivider} />

          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeaderRow}>
              <h3 className={styles.sectionTitle}>피드백</h3>
            </div>

            <div className={styles.feedbackPanelsWrap}>
              <FeedbackPanel
                title="좋아요"
                side="LIKE"
                count={structuredFeedback.likeTotalCount}
                rows={structuredFeedback.likeRows}
              />

              <FeedbackPanel
                title="싫어요"
                side="DISLIKE"
                count={structuredFeedback.dislikeTotalCount}
                rows={structuredFeedback.dislikeRows}
              />
            </div>
          </section>

          <div className={styles.sectionDivider} />

          <section className={styles.sectionBlock}>
            <div className={styles.outfitHeaderRow}>
              <h3 className={styles.outfitTitle}>착용 아이템</h3>

              {isEditingOutfit ? (
                <div className={styles.outfitEditActions}>
                  <button
                    type="button"
                    className={styles.outfitCancelButton}
                    onClick={handleCancelOutfitEdit}
                  >
                    <X size={14} strokeWidth={2.1} />
                    <span>취소</span>
                  </button>

                  <button
                    type="button"
                    className={cls(
                      styles.outfitDeleteButton,
                      deleteMode && styles.outfitDeleteButtonActive,
                    )}
                    onClick={handleToggleDeleteMode}
                  >
                    <Trash2 size={14} strokeWidth={2.1} />
                    <span>삭제</span>
                  </button>

                  <button
                    type="button"
                    className={styles.addItemButton}
                    onClick={handleAddWearItem}
                  >
                    <Plus size={14} strokeWidth={2.5} className={styles.addItemPlusIcon} />
                    <span className={styles.addItemText}>추가</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.outfitEditButton}
                  onClick={handleStartOutfitEdit}
                >
                  <SquarePen size={14} strokeWidth={2.1} />
                  <span>수정하기</span>
                </button>
              )}
            </div>

            {isEditingOutfit ? (
              <>

                <p className={styles.editSummaryText}>
                  추가 {changeSummary.addedCount}건 · 수정 {changeSummary.modifiedCount}건 · 삭제 {changeSummary.deletedCount}건
                </p>

                <div className={styles.itemGrid}>
                  {editableWearItems.map((item) => {
                    const isOpen = openDropdownId === item.id;

                    const isSelectedForDelete = selectedDeleteIds.has(item.id);

                    return (
                      <article
                        key={item.id}
                        className={cls(
                          styles.itemCard,
                          isOpen && styles.itemCardOpen,
                          deleteMode && styles.itemCardDeleteMode,
                          isSelectedForDelete && styles.itemCardSelectedForDelete,
                        )}
                      >
                        {deleteMode ? (
                          <button
                            type="button"
                            className={styles.selectionTouchLayer}
                            onClick={() => handleToggleDeleteSelection(item.id)}
                            aria-label="아이템 선택"
                          />
                        ) : null}

                        <div className={styles.itemInfo}>
                          <WearTypeDropdown
                            value={item.type}
                            options={wearTypeOptions}
                            open={isOpen}
                            onToggle={() =>
                              setOpenDropdownId((prev) => (prev === item.id ? null : item.id))
                            }
                            onClose={() => {
                              setOpenDropdownId((prev) => (prev === item.id ? null : prev));
                            }}
                            onChange={(value) =>
                              handleWearItemChange(item.id, 'type', value)
                            }
                            disabled={deleteMode}
                          />

                          <input
                            type="text"
                            value={item.brand}
                            onChange={(e) =>
                              handleWearItemChange(item.id, 'brand', e.target.value)
                            }
                            placeholder="상품 브랜드"
                            className={styles.itemInput}
                            disabled={deleteMode}
                          />

                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) =>
                              handleWearItemChange(item.id, 'name', e.target.value)
                            }
                            placeholder="상품 이름"
                            className={styles.itemInput}
                            disabled={deleteMode}
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>

                {outfitError ? <p className={styles.errorText}>{outfitError}</p> : null}

                <div className={styles.submitArea}>
                  <button
                    type="button"
                    className={styles.submitButton}
                    onClick={handleCompleteOutfitEdit}
                    disabled={outfitSaving}
                  >
                    {outfitSaving ? '수정 중...' : '수정완료'}
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.itemScroll}>
                {outfitItems.length > 0 ? (
                  outfitItems.map((item, index) => (
                    <div key={item.id ?? index} className={styles.outfitCard}>
                      <div className={`${styles.outfitField} ${styles.outfitCategoryField}`}>
                        <div className={styles.outfitCategoryInner}>
                          <Tag
                            size={13}
                            strokeWidth={2}
                            className={styles.outfitCategoryIcon}
                          />
                          <span className={styles.outfitFieldValue}>
                            {formatCategoryLabel(item.category)}
                          </span>
                        </div>
                      </div>

                      <div className={styles.outfitField}>
                        <span className={styles.outfitFieldValue}>{item.brand || '브랜드 미등록'}</span>
                      </div>

                      <div className={styles.outfitField}>
                        <span className={styles.outfitFieldValue}>
                          {item.itemName || '상품 이름 미등록'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyText}>등록된 아이템이 없습니다.</div>
                )}
              </div>
            )}
          </section>

          {detailError ? <p className={styles.errorText}>{detailError}</p> : null}
        </div>
      </div>

      {confirmDeleteOpen ? (
        <div className={styles.confirmOverlay} onClick={handleCloseDeleteConfirm}>
          <div
            className={styles.confirmCard}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className={styles.confirmTitle}>이대로 수정할까요?</h4>

            <div className={styles.confirmSummaryList}>
              <p className={styles.confirmSummaryRow}>
                <span>추가</span>
                <strong>{changeSummary.addedCount}건</strong>
              </p>
              <p className={styles.confirmSummaryRow}>
                <span>수정</span>
                <strong>{changeSummary.modifiedCount}건</strong>
              </p>
              <p className={styles.confirmSummaryRow}>
                <span>삭제</span>
                <strong>{changeSummary.deletedCount}건</strong>
              </p>
            </div>

            <p className={styles.confirmText}>
              선택한 변경사항이 최종 반영됩니다.
            </p>

            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmCancelButton}
                onClick={handleCloseDeleteConfirm}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.confirmDeleteButton}
                onClick={() => {
                  void handleConfirmOutfitUpdate();
                }}
                disabled={outfitSaving}
              >
                {outfitSaving ? '수정 중...' : '수정'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MyFeedDetail;
