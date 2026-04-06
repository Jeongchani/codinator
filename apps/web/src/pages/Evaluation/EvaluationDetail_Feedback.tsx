import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type {
  CreateFeedbackResponse,
  FeedbackTag,
  GetEvaluationPostDetailResponse,
  GetTagsResponse,
  VoteChoice,
} from '@codinator/contracts';
import {
  clearAuthTokens,
  fetcher,
  getAuthHeaders,
  getPrimaryPostImageUrl,
} from '../../lib/api';
import styles from './EvaluationDetail_Feedback.module.css';

const EvaluationDetailFeedback: React.FC = () => {
  const navigate = useNavigate();
  const { postId } = useParams();
  const [searchParams] = useSearchParams();

  const voteId = searchParams.get('voteId');
  const rawVoteChoice = searchParams.get('voteChoice');

  const voteChoice: VoteChoice | null =
    rawVoteChoice === 'LIKE' || rawVoteChoice === 'DISLIKE'
      ? rawVoteChoice
      : null;

  const [data, setData] = useState<GetEvaluationPostDetailResponse | null>(null);
  const [keywords, setKeywords] = useState<FeedbackTag[]>([]);
  const [selectedKeywordId, setSelectedKeywordId] = useState<number | null>(null);
  const [savedKeywordId, setSavedKeywordId] = useState<number | null>(null);
  const [savedKeywordLabel, setSavedKeywordLabel] = useState('');

  const [detailLoading, setDetailLoading] = useState(true);
  const [tagLoading, setTagLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [detailError, setDetailError] = useState('');
  const [tagError, setTagError] = useState('');

  const canWriteFeedback = Boolean(postId && voteId && voteChoice);

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

  const loadDetail = useCallback(async () => {
    if (!postId) {
      setDetailError('게시글 정보가 없습니다.');
      setDetailLoading(false);
      return;
    }

    try {
      setDetailLoading(true);
      setDetailError('');

      const response = await fetcher<GetEvaluationPostDetailResponse>(
        `/evaluations/posts/${postId}`,
        {
          headers: getAuthHeaders(),
        },
      );

      setData(response);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '평가 상세를 불러오지 못했습니다.';
      setDetailError(message);
      handleAuthError(message);
    } finally {
      setDetailLoading(false);
    }
  }, [handleAuthError, postId]);

  const loadTags = useCallback(async () => {
    if (!voteChoice) {
      setKeywords([]);
      setTagLoading(false);
      return;
    }

    try {
      setTagLoading(true);
      setTagError('');

      const response = await fetcher<GetTagsResponse>(
        `/evaluations/tags?voteChoice=${voteChoice}`,
        {
          headers: getAuthHeaders(),
        },
      );

      setKeywords(response.items ?? []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '피드백 태그를 불러오지 못했습니다.';
      setTagError(message);
      handleAuthError(message);
    } finally {
      setTagLoading(false);
    }
  }, [handleAuthError, voteChoice]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  const likeKeywords = useMemo(() => {
    return (data?.feedbackSummary ?? []).filter((item) =>
      item.voteChoice ? item.voteChoice === 'LIKE' : item.code?.startsWith('POS_'),
    );
  }, [data]);

  const dislikeKeywords = useMemo(() => {
    return (data?.feedbackSummary ?? []).filter((item) =>
      item.voteChoice ? item.voteChoice === 'DISLIKE' : item.code?.startsWith('NEG_'),
    );
  }, [data]);

  const topKeywords = useMemo(() => {
    const base = data?.feedbackSummary ?? [];

    if (!savedKeywordLabel) {
      return base.slice(0, 5);
    }

    return base.filter((item) => item.label !== savedKeywordLabel).slice(0, 5);
  }, [data, savedKeywordLabel]);

  const selectedKeyword = useMemo(() => {
    return keywords.find((keyword) => keyword.id === selectedKeywordId) ?? null;
  }, [keywords, selectedKeywordId]);

  const currentFeedbackChip = useMemo(() => {
    const label = savedKeywordLabel || selectedKeyword?.label;
    if (!label || !voteChoice) {
      return null;
    }

    const prefix = voteChoice === 'DISLIKE' ? '👎' : '👍';
    return `${prefix} ${label}`;
  }, [savedKeywordLabel, selectedKeyword, voteChoice]);

  const voteChoiceLabel = useMemo(() => {
    if (voteChoice === 'LIKE') return '좋아요';
    if (voteChoice === 'DISLIKE') return '싫어요';
    return '';
  }, [voteChoice]);

  const voteChoiceGuide = useMemo(() => {
    if (voteChoice === 'LIKE') {
      return '마음에 든 포인트를 1개 선택해서 추가 피드백을 남겨보세요.';
    }

    if (voteChoice === 'DISLIKE') {
      return '아쉬웠던 포인트를 1개 선택해서 추가 피드백을 남겨보세요.';
    }

    return '상세 정보만 확인할 수 있는 화면입니다.';
  }, [voteChoice]);

  const handleGoEvaluationZone = () => {
    navigate('/evaluationZone');
  };

  const handleKeywordClick = (id: number) => {
    if (submitting || savedKeywordId !== null) return;
    setSelectedKeywordId((prev) => (prev === id ? null : id));
  };

  const handleSaveFeedback = async () => {
    if (!postId || !voteId || selectedKeywordId === null || savedKeywordId !== null) {
      return;
    }

    try {
      setSubmitting(true);
      setTagError('');

      await fetcher<CreateFeedbackResponse>(`/evaluations/votes/${voteId}/feedback`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ tagIds: [selectedKeywordId] }),
      });

      const selected = keywords.find((keyword) => keyword.id === selectedKeywordId) ?? null;

      setSavedKeywordId(selectedKeywordId);
      setSavedKeywordLabel(selected?.label ?? '');

      await loadDetail();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '피드백 저장에 실패했습니다.';
      setTagError(message);
      handleAuthError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const saveButtonDisabled =
    selectedKeywordId === null || submitting || tagLoading || savedKeywordId !== null;

  const saveButtonText = submitting
    ? '저장 중...'
    : savedKeywordId !== null
      ? '피드백 저장 완료'
      : '피드백 저장';

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
            {detailError || '평가 상세를 불러올 수 없습니다.'}
          </div>

          <div className={styles.buttonStack}>
            <button
              type="button"
              onClick={handleGoEvaluationZone}
              className={`${styles.completeButton} ${styles.completeButtonActive}`}
            >
              평가존으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>
        <section className={styles.headerSection}>
          <div className={styles.textBlock}>
            <h1 className={styles.mainTitle}>{data.content || '코디 스타일 한마디'}</h1>
            <p className={styles.subText}>
              평가 종료 예정: {new Date(data.evaluation.endsAt).toLocaleString('ko-KR')}
            </p>
          </div>

          <div className={styles.topKeywordRow}>
            {currentFeedbackChip ? (
              <span className={styles.topKeywordChip}>{currentFeedbackChip}</span>
            ) : null}

            {topKeywords.length > 0 ? (
              topKeywords.map((keyword) => (
                <span key={keyword.tagId} className={styles.topKeywordChip}>
                  #{keyword.label}
                </span>
              ))
            ) : !currentFeedbackChip ? (
              <span className={styles.topKeywordChip}># 아직 선택된 태그 없음</span>
            ) : null}
          </div>

          <div className={styles.imageWrap}>
            <img
              src={getPrimaryPostImageUrl(data)}
              alt="평가 이미지"
              className={styles.image}
            />
          </div>
        </section>

        <section className={styles.feedbackComposerSection}>
          <div className={styles.feedbackComposerHeader}>
            <h2 className={styles.feedbackComposerTitle}>나의 평가 남기기</h2>

            {voteChoiceLabel ? (
              <span
                className={`${styles.voteChoiceBadge} ${
                  voteChoice === 'LIKE' ? styles.likeChoice : styles.dislikeChoice
                }`}
              >
                {voteChoiceLabel} 선택
              </span>
            ) : null}
          </div>

          <p className={styles.feedbackGuide}>{voteChoiceGuide}</p>

          {canWriteFeedback ? (
            <>
              {tagLoading ? (
                <div className={styles.feedbackEmptyBox}>피드백 태그 불러오는 중...</div>
              ) : tagError && keywords.length === 0 ? (
                <div className={styles.feedbackErrorText}>{tagError}</div>
              ) : keywords.length > 0 ? (
                <div className={styles.feedbackSelectGrid}>
                  {keywords.map((keyword) => {
                    const isSelected = selectedKeywordId === keyword.id;

                    return (
                      <button
                        key={keyword.id}
                        type="button"
                        onClick={() => handleKeywordClick(keyword.id)}
                        disabled={savedKeywordId !== null}
                        className={`${styles.selectChip} ${
                          isSelected ? styles.selectChipSelected : ''
                        }`}
                      >
                        {keyword.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.feedbackEmptyBox}>
                  선택 가능한 피드백 태그가 없습니다.
                </div>
              )}


              {savedKeywordId !== null ? (
                <p className={styles.feedbackSavedText}>
                  피드백이 저장됐어요. 아래 종합 수치에서도 바로 확인할 수 있어요.
                </p>
              ) : (
                <p className={styles.feedbackHintText}>최대 1개까지만 선택할 수 있어요.</p>
              )}

              {tagError && keywords.length > 0 ? (
                <p className={styles.feedbackErrorText}>{tagError}</p>
              ) : null}

              <div className={styles.feedbackActionArea}>
                <button
                  type="button"
                  onClick={handleSaveFeedback}
                  disabled={saveButtonDisabled}
                  className={`${styles.feedbackInlineButton} ${
                    saveButtonDisabled
                      ? styles.feedbackInlineButtonDisabled
                      : styles.feedbackInlineButtonActive
                  }`}
                >
                  {saveButtonText}
                </button>
              </div>
            </>
          ) : (
            <div className={styles.feedbackEmptyBox}>
              이 화면은 상세보기 전용으로 열렸습니다.
            </div>
          )}
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
                  ? Math.round(
                      (data.voteSummary.dislikeCount / data.voteSummary.totalCount) * 100,
                    )
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

        {detailError ? <p className={styles.feedbackErrorText}>{detailError}</p> : null}

        <div className={styles.buttonStack}>
          <button
            type="button"
            onClick={handleGoEvaluationZone}
            className={styles.secondaryButton}
          >
            평가존으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default EvaluationDetailFeedback;