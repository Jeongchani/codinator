import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type {
  GetPostDetailResponse,
  UpdatePostRequest,
  UpdatePostResponse,
} from '@codinator/contracts';
import { clearAuthTokens, fetcher, getAuthHeaders } from '../../lib/api';
import styles from './MyFeedEdit.module.css';

type LocationState = {
  post?: { postId?: number; id?: number };
};

export default function MyFeedEdit() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | undefined;

  const resolvedPostId = state?.post?.postId ?? state?.post?.id ?? null;

  const [postData, setPostData] = useState<GetPostDetailResponse | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAuthError = useCallback(
    (message: string) => {
      if (
        message.includes('Unauthorized') ||
        message.includes('로그인이 필요합니다') ||
        message.includes('유효하지 않거나 만료된 토큰')
      ) {
        clearAuthTokens();
        navigate('/login');
      }
    },
    [navigate],
  );

  useEffect(() => {
    if (!resolvedPostId) {
      setError('게시글 정보가 없습니다.');
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const data = await fetcher<GetPostDetailResponse>(
          `/posts/me/${resolvedPostId}`,
          { headers: getAuthHeaders() },
        );

        setPostData(data);
        setContent(data.content ?? '');
      } catch (err) {
        const message = err instanceof Error ? err.message : '게시글을 불러오지 못했습니다.';
        setError(message);
        handleAuthError(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [resolvedPostId, handleAuthError]);

  const handleComplete = async () => {
    if (!resolvedPostId || saving) return;

    try {
      setSaving(true);
      setError('');

      const body: UpdatePostRequest = { content };

      await fetcher<UpdatePostResponse>(`/posts/${resolvedPostId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      navigate(`/myFeedDetail/${resolvedPostId}`, {
        state: { post: state?.post },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '게시글 수정에 실패했습니다.';
      setError(message);
      handleAuthError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.scrollArea}>
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#999' }}>
            게시글 불러오는 중...
          </div>
        </div>
      </div>
    );
  }

  if (!postData) {
    return (
      <div className={styles.container}>
        <div className={styles.scrollArea}>
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#999' }}>
            {error || '게시글을 불러올 수 없습니다.'}
          </div>
          <div className={styles.bottomButtonWrap}>
            <button type="button" className={styles.completeButton} onClick={() => navigate(-1)}>
              돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  const primaryImage =
    postData.images.find((img) => img.isPrimary)?.processedImageUrl ??
    postData.images[0]?.processedImageUrl ??
    postData.images[0]?.originalImageUrl ??
    null;

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>
        <section className={styles.imageSection}>
          <div className={styles.mainImage}>
            {primaryImage && (
              <img
                src={primaryImage}
                alt="게시글 이미지"
                className={styles.mainImageTag}
              />
            )}

            <button
              type="button"
              className={styles.backButton}
              onClick={() => navigate(-1)}
              aria-label="뒤로가기"
            >
              ←
            </button>
          </div>
        </section>

        <section className={styles.infoSection}>
          <h1 className={styles.title}>게시글 수정</h1>
          <textarea
            className={styles.description}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="코디 설명을 입력해주세요 (최대 500자)"
            style={{ width: '100%', resize: 'none', boxSizing: 'border-box' }}
          />
          <p style={{ fontSize: '12px', color: '#999', textAlign: 'right' }}>
            {content.length}/500
          </p>
        </section>

        {postData.keywords.length > 0 && (
          <section className={styles.tagSection}>
            <div className={styles.tagList}>
              {postData.keywords.map((keyword) => (
                <span
                  key={keyword.id}
                  className={styles.tagSelected}
                >
                  {keyword.label}
                </span>
              ))}
            </div>
          </section>
        )}

        <div className={styles.divider} />

        {postData.outfitItems.length > 0 && (
          <section className={styles.itemSection}>
            <h2 className={styles.sectionTitle}>착용 아이템</h2>

            <div className={styles.itemGrid}>
              {postData.outfitItems.map((item) => (
                <article key={item.id} className={styles.itemCard}>
                  <div className={styles.itemImage} />
                  <div className={styles.itemInfo}>
                    <p className={styles.itemBrand}>{item.brand ?? item.category}</p>
                    <p className={styles.itemName}>{item.itemName ?? '아이템명 없음'}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {error ? (
          <p style={{ color: '#FF3B30', fontSize: '13px', padding: '0 20px' }}>{error}</p>
        ) : null}

        <div className={styles.bottomButtonWrap}>
          <button
            type="button"
            className={styles.completeButton}
            onClick={handleComplete}
            disabled={saving}
          >
            {saving ? '저장 중...' : '게시물 수정 완료'}
          </button>
        </div>
      </div>
    </div>
  );
}
