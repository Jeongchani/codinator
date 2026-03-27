import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type {
  CreateFeedbackResponse,
  FeedbackTag,
  GetTagsResponse,
  VoteChoice,
} from '@codinator/contracts';
import { clearAuthTokens, fetcher, getAuthHeaders } from '../../lib/api';
import styles from './EvaluationFeedback.module.css';

const EvaluationFeedback: React.FC = () => {
  const navigate = useNavigate();
  const { postId } = useParams();
  const [searchParams] = useSearchParams();

  const voteId = searchParams.get('voteId');
  const rawVoteChoice = searchParams.get('voteChoice');
  const voteChoice: VoteChoice | null =
    rawVoteChoice === 'LIKE' || rawVoteChoice === 'DISLIKE' ? rawVoteChoice : null;

  const [keywords, setKeywords] = useState<FeedbackTag[]>([]);
  const [selectedKeywordId, setSelectedKeywordId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTags = async () => {
      if (!voteChoice) {
        setError('투표 정보가 없습니다. 평가존에서 다시 시도해주세요.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const data = await fetcher<GetTagsResponse>(`/evaluations/tags?voteChoice=${voteChoice}`, {
          headers: getAuthHeaders(),
        });

        setKeywords(data.items ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : '피드백 태그를 불러오지 못했습니다.';
        setError(message);

        if (message.includes('Unauthorized') || message.includes('로그인이 필요합니다')) {
          clearAuthTokens();
          navigate('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    void loadTags();
  }, [navigate, voteChoice]);

  const handleKeywordClick = (id: number) => {
    setSelectedKeywordId((prev) => (prev === id ? null : id));
  };

  const handleComplete = async () => {
    if (!voteId || !postId || selectedKeywordId === null) {
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      await fetcher<CreateFeedbackResponse>(`/evaluations/votes/${voteId}/feedback`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ tagIds: [selectedKeywordId] }),
      });

      const selectedKeyword = keywords.find((keyword) => keyword.id === selectedKeywordId) ?? null;

      navigate(`/evaluation-detail/${postId}`, {
        state: {
          selectedTagId: selectedKeyword?.id ?? null,
          selectedTagLabel: selectedKeyword?.label ?? '',
          selectedVoteChoice: voteChoice,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '피드백 저장에 실패했습니다.';
      setError(message);

      if (message.includes('Unauthorized') || message.includes('로그인이 필요합니다')) {
        clearAuthTokens();
        navigate('/login');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className={styles.container}><main><div className={styles.titleArea}><h1 className={styles.title}>피드백 태그 불러오는 중...</h1></div></main></div>;
  }

  if (error && !keywords.length) {
    return (
      <div className={styles.container}>
        <main>
          <div className={styles.titleArea}>
            <h1 className={styles.title}>피드백을 선택할 수 없습니다</h1>
            <p className={styles.guideText}>{error}</p>
          </div>
        </main>
        <button type="button" onClick={() => navigate('/evaluationZone')} className={styles.completeButton}>
          평가존으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <main>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>
            코디에 대한 나만의 평가를
            <br />
            선택해 주세요
          </h1>
          <p className={styles.guideText}>최대 1개까지만 선택해주세요</p>
        </div>

        <div className={styles.keywordGrid}>
          {keywords.map((keyword) => {
            const isSelected = selectedKeywordId === keyword.id;

            return (
              <button
                key={keyword.id}
                type="button"
                onClick={() => handleKeywordClick(keyword.id)}
                className={`${styles.keywordChip} ${isSelected ? styles.keywordChipSelected : ''}`}
              >
                <span className={styles.keywordText}>{keyword.label}</span>

                {isSelected && (
                  <span className={styles.checkBadge}>
                    <span className={styles.checkPlus}>+</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error ? <p style={{ marginTop: 16, textAlign: 'center', color: '#ef4444' }}>{error}</p> : null}
      </main>

      <button
        type="button"
        onClick={handleComplete}
        disabled={selectedKeywordId === null || submitting}
        className={`${styles.completeButton} ${
          selectedKeywordId !== null ? styles.completeButtonActive : styles.completeButtonDisabled
        }`}
      >
        {submitting ? '저장 중...' : '평가완료'}
      </button>
    </div>
  );
};

export default EvaluationFeedback;
