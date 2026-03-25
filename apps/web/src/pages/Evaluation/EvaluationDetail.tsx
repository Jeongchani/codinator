import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { GetEvaluationPostDetailResponse } from '@codinator/contracts';
import {
  clearAuthTokens,
  fetcher,
  getAuthHeaders,
  resolveAssetUrl,
} from '../../lib/api';
import styles from './EvaluationDetail.module.css';

const EvaluationDetail: React.FC = () => {
  const navigate = useNavigate();
  const { postId } = useParams();
  const [data, setData] = useState<GetEvaluationPostDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDetail = async () => {
      if (!postId) {
        setError('게시글 정보가 없습니다.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const response = await fetcher<GetEvaluationPostDetailResponse>(`/evaluations/posts/${postId}`, {
          headers: getAuthHeaders(),
        });

        setData(response);
      } catch (err) {
        const message = err instanceof Error ? err.message : '평가 상세를 불러오지 못했습니다.';
        setError(message);

        if (message.includes('Unauthorized') || message.includes('로그인이 필요합니다')) {
          clearAuthTokens();
          navigate('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    void loadDetail();
  }, [navigate, postId]);

  const likeKeywords = useMemo(() => {
    return (data?.feedbackSummary ?? []).filter((item) => item.code.startsWith('POS_'));
  }, [data]);

  const dislikeKeywords = useMemo(() => {
    return (data?.feedbackSummary ?? []).filter((item) => item.code.startsWith('NEG_'));
  }, [data]);

  const topKeywords = useMemo(() => {
    return (data?.feedbackSummary ?? []).slice(0, 5);
  }, [data]);

  const handleGoEvaluationZone = () => {
    navigate('/evaluationZone');
  };

  if (loading) {
    return <div className={styles.container}><div className={styles.scrollArea}>로딩 중...</div></div>;
  }

  if (!data) {
    return <div className={styles.container}><div className={styles.scrollArea}>{error || '평가 상세를 불러올 수 없습니다.'}</div></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>
        <section className={styles.headerSection}>
          <div className={styles.textBlock}>
            <h1 className={styles.mainTitle}>{data.content || '코디 스타일 한마디'}</h1>
            <p className={styles.subText}>평가 종료 예정: {new Date(data.evaluation.endsAt).toLocaleString('ko-KR')}</p>
          </div>

          <div className={styles.topKeywordRow}>
            {topKeywords.length > 0 ? (
              topKeywords.map((keyword) => (
                <span key={keyword.tagId} className={styles.topKeywordChip}>
                  #{keyword.label}
                </span>
              ))
            ) : (
              <span className={styles.topKeywordChip}># 아직 선택된 태그 없음</span>
            )}
          </div>

          <div style={{ marginTop: 16, overflow: 'hidden', borderRadius: 24 }}>
            <img
              src={resolveAssetUrl(data.image.imageUrl)}
              alt="평가 이미지"
              style={{ width: '100%', maxHeight: 360, objectFit: 'cover' }}
            />
          </div>
        </section>

        <div className={styles.divider} />

        <section className={styles.scoreSection}>
          <h2 className={styles.sectionTitle}>종합 피드백 수치</h2>

          <div className={styles.scoreWrap}>
            <div className={styles.mainScoreGroup}>
              <div className={styles.bigScore}>
                {Math.round(data.voteSummary.likeRate * 100)}
                <span className={styles.percent}>%</span>
              </div>
              <p className={styles.scoreLabel}>좋아요</p>
            </div>

            <div className={styles.subScoreGroup}>
              <div className={styles.smallScore}>
                {data.voteSummary.totalCount > 0
                  ? Math.round((data.voteSummary.dislikeCount / data.voteSummary.totalCount) * 100)
                  : 0}
                <span className={styles.smallPercent}>%</span>
              </div>
              <p className={styles.scoreLabel}>싫어요</p>
            </div>
          </div>
        </section>

        <section className={styles.feedbackListSection}>
          <div className={styles.feedbackRow}>
            <div className={styles.iconCircle}>
              <span className={styles.iconText}>👍</span>
            </div>
            <div className={styles.feedbackKeywords}>
              {likeKeywords.length > 0 ? (
                likeKeywords.map((keyword) => (
                  <span key={keyword.tagId} className={styles.feedbackChip}>
                    {keyword.label} ({keyword.count})
                  </span>
                ))
              ) : (
                <span className={styles.feedbackChip}>좋아요 태그 없음</span>
              )}
            </div>
          </div>

          <div className={styles.feedbackRow}>
            <div className={styles.iconCircle}>
              <span className={styles.iconText}>👎</span>
            </div>
            <div className={styles.feedbackKeywords}>
              {dislikeKeywords.length > 0 ? (
                dislikeKeywords.map((keyword) => (
                  <span key={keyword.tagId} className={styles.feedbackChip}>
                    {keyword.label} ({keyword.count})
                  </span>
                ))
              ) : (
                <span className={styles.feedbackChip}>싫어요 태그 없음</span>
              )}
            </div>
          </div>

          <div className={styles.feedbackRow}>
            <div className={styles.iconCircle}>
              <span className={styles.iconText}>📊</span>
            </div>
            <div className={styles.feedbackKeywords}>
              <span className={styles.feedbackChip}>총 투표 {data.voteSummary.totalCount}</span>
              <span className={styles.feedbackChip}>좋아요 {data.voteSummary.likeCount}</span>
              <span className={styles.feedbackChip}>싫어요 {data.voteSummary.dislikeCount}</span>
            </div>
          </div>
        </section>

        <div className={styles.itemDivider} />

        <section className={styles.itemSection}>
          <div className={styles.itemHeader}>
            <h2 className={styles.itemTitle}>착용 아이템</h2>
          </div>

          <div className={styles.itemScrollRow}>
            {data.outfitItems.length > 0 ? (
              data.outfitItems.map((item) => (
                <div key={item.id} className={styles.itemCard}>
                  <div className={styles.itemImage} />
                  <div className={styles.itemInfo}>
                    <p className={styles.itemBrand}>{item.brand || item.category}</p>
                    <p className={styles.itemPrice}>{item.itemName || '아이템명 없음'}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.itemCard}>
                <div className={styles.itemInfo}>
                  <p className={styles.itemBrand}>등록된 착용 아이템 없음</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {error ? <p style={{ padding: '0 8px', color: '#ef4444' }}>{error}</p> : null}

        <div className={styles.bottomButtonWrap}>
          <button type="button" onClick={handleGoEvaluationZone} className={styles.completeButton}>
            평가존으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default EvaluationDetail;
