import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronLeft,
  ImagePlus,
  Menu,
  Search as SearchIcon,
  X,
} from 'lucide-react';
import SideMenu from '../../components/SideMenu';
import styles from './Search.module.css';

type SearchMode = 'text' | 'image';

export type SearchFilterId = 'period' | 'likeRatio' | 'outfit' | 'keyword' | 'feedbackTag' | 'scope';

type SearchFilter = {
  id: SearchFilterId;
  label: string;
};

type SearchProps = {
  onOpenFilter?: (filterId: SearchFilterId) => void;
};

const FILTERS: SearchFilter[] = [
  { id: 'period', label: '기간' },
  { id: 'likeRatio', label: '좋아요 비율' },
  { id: 'outfit', label: '아웃핏' },
  { id: 'keyword', label: '키워드' },
  { id: 'feedbackTag', label: '피드백 태그' },
];

const RECENT_KEYWORDS = ['검색어', '검색어', '검색어', '검색어'];
const PLACEHOLDER_RESULTS = Array.from({ length: 15 }, (_, index) => index + 1);

export default function Search({ onOpenFilter }: SearchProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<SearchMode>('text');
  const [query, setQuery] = useState('');
  const [recentKeywords, setRecentKeywords] = useState(RECENT_KEYWORDS);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const isTextMode = mode === 'text';
  const isImageMode = mode === 'image';
  const hasImageResult = Boolean(imagePreviewUrl);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleOpenMenu = () => {
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setMenuOpen(false);
  };

  const handleChangeMode = (nextMode: SearchMode) => {
    setMode(nextMode);
  };

  const handleOpenImagePicker = () => {
    fileInputRef.current?.click();
  };

  const handleChangeImage = (event: ChangeEvent<HTMLInputElement>) => {
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
    event.target.value = '';
  };

  const handleClearQuery = () => {
    setQuery('');
  };

  const handleRemoveRecentKeyword = (indexToRemove: number) => {
    setRecentKeywords((previousKeywords) =>
      previousKeywords.filter((_, index) => index !== indexToRemove),
    );
  };

  const handleClearRecentKeywords = () => {
    setRecentKeywords([]);
  };

  const handleOpenFilter = (filterId: SearchFilterId) => {
    onOpenFilter?.(filterId);
  };

  return (
    <>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <button
              type="button"
              className={styles.backButton}
              onClick={handleGoBack}
              aria-label="뒤로가기"
            >
              <ChevronLeft size={25} strokeWidth={2.2} />
            </button>

            <h1 className={styles.headerTitle}>검색</h1>

            <button
              type="button"
              className={styles.menuButton}
              onClick={handleOpenMenu}
              aria-label="메뉴 열기"
            >
              <Menu size={25} strokeWidth={2.2} />
            </button>
          </div>
        </header>

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
                    <SearchIcon size={20} strokeWidth={2.1} className={styles.searchInputIcon} />
                    <input
                      className={styles.searchInput}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
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

                  <button
                    type="button"
                    className={`${styles.filterButton} ${styles.scopeButton}`}
                    onClick={() => handleOpenFilter('scope')}
                  >
                    <span>전체</span>
                    <ChevronDown size={20} strokeWidth={2.1} />
                  </button>
                </div>

                <FilterScroller filters={FILTERS} onOpenFilter={handleOpenFilter} />

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
                    {recentKeywords.map((keyword, index) => (
                      <div
                        // 같은 더미 텍스트가 반복되므로 index를 같이 사용합니다.
                        key={`${keyword}-${index}`}
                        className={styles.recentChip}
                      >
                        <button
                          type="button"
                          className={styles.recentChipTextButton}
                          onClick={() => setQuery(keyword)}
                        >
                          {keyword}
                        </button>
                        <button
                          type="button"
                          className={styles.recentChipRemove}
                          onClick={() => handleRemoveRecentKeyword(index)}
                          aria-label={`${keyword} 삭제`}
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
                      <img src={imagePreviewUrl ?? ''} alt="업로드한 이미지" className={styles.uploadedImage} />
                    </div>

                    <div className={styles.imageResultCopy}>
                      <p className={styles.imageResultTitle}>비슷한 스타일을 찾았어요</p>
                      <p className={styles.imageResultDescription}>찾으시는 스타일을 확인해보세요</p>
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

                <FilterScroller filters={FILTERS} onOpenFilter={handleOpenFilter} />
              </section>
            )}

            <section className={styles.resultSection} aria-label="검색 결과">
              <p className={styles.resultCount}>검색 결과 00,000개</p>

              <div className={styles.resultGrid}>
                {PLACEHOLDER_RESULTS.map((item) => (
                  <button key={item} type="button" className={styles.resultCard} aria-label={`검색 결과 ${item}`}>
                    <span className={styles.resultGradient} />
                  </button>
                ))}
              </div>
            </section>
          </section>

          <div className={styles.footerSpacer} aria-hidden="true" />
        </main>
      </div>

      <SideMenu isOpen={menuOpen} onClose={handleCloseMenu} />
    </>
  );
}

type FilterScrollerProps = {
  filters: SearchFilter[];
  onOpenFilter: (filterId: SearchFilterId) => void;
};

function FilterScroller({ filters, onOpenFilter }: FilterScrollerProps) {
  return (
    <div className={styles.filterScrollArea} aria-label="검색 필터">
      <div className={styles.filterRow}>
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={styles.filterButton}
            onClick={() => onOpenFilter(filter.id)}
          >
            <span>{filter.label}</span>
            <ChevronDown size={20} strokeWidth={2.1} />
          </button>
        ))}
      </div>
    </div>
  );
}
