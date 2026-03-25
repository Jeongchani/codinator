import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./EvaluationDetail.module.css";

type LocationState = {
  selectedKeywordId?: number;
  selectedKeywordLabel?: string;
};

const EvaluationDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedKeywordLabel } = (location.state || {}) as LocationState;

  const topKeywords = [
    selectedKeywordLabel ? `# ${selectedKeywordLabel}` : "# 키워드",
    "# 키워드",
    "# 키워드",
    "# 키워드",
    "# 키워드",
  ];

  const likeKeywords = ["# 키워드", "# 키워드", "# 키워드"];
  const dislikeKeywords = ["# 키워드", "# 키워드", "# 키워드"];
  const neutralKeywords = ["# 키워드", "# 키워드", "# 키워드"];

  const items = [
    { id: 1, brand: "옷 브랜드 명", price: "00,000원" },
    { id: 2, brand: "옷 브랜드 명", price: "00,000원" },
    { id: 3, brand: "옷 브랜드 명", price: "00,000원" },
    { id: 4, brand: "옷 브랜드 명", price: "00,000원" },
    { id: 5, brand: "옷 브랜드 명", price: "00,000원" },
  ];

  const handleGoEvaluationZone = () => {
    navigate("/evaluationZone");
  };

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>
        <section className={styles.headerSection}>
          <div className={styles.textBlock}>
            <h1 className={styles.mainTitle}>코디 스타일 한마디</h1>
            <p className={styles.subText}>
              코디 설명 자세히
              <br />
              최대두줄정도
            </p>
          </div>

          <div className={styles.topKeywordRow}>
            {topKeywords.map((keyword, index) => (
              <span key={`${keyword}-${index}`} className={styles.topKeywordChip}>
                {keyword}
              </span>
            ))}
          </div>
        </section>

        <div className={styles.divider} />

        <section className={styles.scoreSection}>
          <h2 className={styles.sectionTitle}>종합 피드백 수치</h2>

          <div className={styles.scoreWrap}>
            <div className={styles.mainScoreGroup}>
              <div className={styles.bigScore}>
                89<span className={styles.percent}>%</span>
              </div>
              <p className={styles.scoreLabel}>좋아요</p>
            </div>

            <div className={styles.subScoreGroup}>
              <div className={styles.smallScore}>
                12<span className={styles.smallPercent}>%</span>
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
              {likeKeywords.map((keyword, index) => (
                <span key={`${keyword}-${index}`} className={styles.feedbackChip}>
                  {keyword}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.feedbackRow}>
            <div className={styles.iconCircle}>
              <span className={styles.iconText}>👎</span>
            </div>
            <div className={styles.feedbackKeywords}>
              {dislikeKeywords.map((keyword, index) => (
                <span key={`${keyword}-${index}`} className={styles.feedbackChip}>
                  {keyword}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.feedbackRow}>
            <div className={styles.iconCircle}>
              <span className={styles.iconText}>👍</span>
            </div>
            <div className={styles.feedbackKeywords}>
              {neutralKeywords.map((keyword, index) => (
                <span key={`${keyword}-${index}`} className={styles.feedbackChip}>
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className={styles.itemDivider} />

        <section className={styles.itemSection}>
          <div className={styles.itemHeader}>
            <h2 className={styles.itemTitle}>착용 아이템</h2>
            <button type="button" className={styles.moreButton}>
              더보기 <span className={styles.arrow}>&gt;</span>
            </button>
          </div>

          <div className={styles.itemScrollRow}>
            {items.map((item) => (
              <div key={item.id} className={styles.itemCard}>
                <div className={styles.itemImage} />
                <div className={styles.itemInfo}>
                  <p className={styles.itemBrand}>{item.brand}</p>
                  <p className={styles.itemPrice}>{item.price}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className={styles.bottomButtonWrap}>
          <button
            type="button"
            onClick={handleGoEvaluationZone}
            className={styles.completeButton}
          >
            평가존으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default EvaluationDetail;