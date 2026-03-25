import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./EvaluationFeedback.module.css";

type KeywordItem = {
  id: number;
  label: string;
  emoji?: string;
};

const EvaluationFeedback = () => {
  const navigate = useNavigate();
  const [selectedKeywordId, setSelectedKeywordId] = useState<number | null>(null);

  const keywords: KeywordItem[] = useMemo(
    () => [
      { id: 1, label: "스포티하다", emoji: "🏃" },
      { id: 2, label: "힙합적이다", emoji: "😎" },
      { id: 3, label: "분위기 있다", emoji: "✨" },
      { id: 4, label: "유니크하다", emoji: "🔥" },
      { id: 5, label: "트렌디하다", emoji: "🖤" },
      { id: 6, label: "캐주얼하다", emoji: "👕" },
      { id: 7, label: "스트릿하다", emoji: "🛹" },
      { id: 8, label: "깔끔하다", emoji: "🤍" },
      { id: 9, label: "힙하다", emoji: "🎧" },
      { id: 10, label: "감각적이다", emoji: "💫" },
    ],
    []
  );

  const handleKeywordClick = (id: number) => {
    setSelectedKeywordId((prev) => (prev === id ? null : id));
  };

  const handleComplete = () => {
    if (selectedKeywordId === null) return;

    const selectedKeyword = keywords.find((item) => item.id === selectedKeywordId);

    navigate("/evaluation-detail", {
      state: {
        selectedKeywordId,
        selectedKeywordLabel: selectedKeyword?.label ?? "",
      },
    });
  };

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
                className={`${styles.keywordChip} ${isSelected ? styles.keywordChipSelected : ""}`}
              >
                <span className={styles.emojiBox}>{keyword.emoji}</span>
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
      </main>

      <button
        type="button"
        onClick={handleComplete}
        disabled={selectedKeywordId === null}
        className={`${styles.completeButton} ${
          selectedKeywordId !== null ? styles.completeButtonActive : styles.completeButtonDisabled
        }`}
      >
        평가완료
      </button>
    </div>
  );
};

export default EvaluationFeedback;