import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./EvaluationDetail2.module.css";

type LocationState = {
  selectedKeywordId?: number;
  selectedKeywordLabel?: string;
};

const EvaluationDetail2 = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedKeywordLabel } = (location.state || {}) as LocationState;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const [hasReachedBottom, setHasReachedBottom] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const topKeywords = [
    selectedKeywordLabel ? `# ${selectedKeywordLabel}` : "# 키워드",
    "# 스트릿",
    "# 감각적",
    "# 트렌디",
    "# 캐주얼",
  ];

  const likeKeywords = ["# 핏이좋다", "# 색조합굿", "# 분위기있다"];
  const dislikeKeywords = ["# 밸런스아쉽다", "# 포인트약함", "# 단조롭다"];
  const neutralKeywords = ["# 무난하다", "# 데일리룩", "# 깔끔하다"];

  const items = [
    { id: 1, brand: "옷 브랜드 명", price: "00,000원" },
    { id: 2, brand: "옷 브랜드 명", price: "00,000원" },
    { id: 3, brand: "옷 브랜드 명", price: "00,000원" },
  ];

  const checkReachedBottom = () => {
    const el = scrollRef.current;
    if (!el || hasReachedBottom) return;

    const threshold = 20;
    const isBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;

    if (isBottom) {
      setCountdown(3);
      setHasReachedBottom(true);
    }
  };

  useEffect(() => {
    if (!hasReachedBottom) return;

    const interval = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    timeoutRef.current = window.setTimeout(() => {
      navigate("/evaluation-zone");
    }, 3000);

    return () => {
      window.clearInterval(interval);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [hasReachedBottom, navigate]);

  return (
    <div className={styles.container}>
      <div
        ref={scrollRef}
        className={styles.scrollArea}
        onScroll={checkReachedBottom}
      >
        <section className={styles.headerSection}>
          <div className={styles.textBlock}>
            <h1 className={styles.mainTitle}>코디 스타일 한마디</h1>
            <p className={styles.subText}>
              코디 설명 자세히
              <br />
              최대 두줄 정도
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
            <div className={styles.scoreBox}>
              <div className={styles.bigScore}>
                89<span className={styles.percent}>%</span>
              </div>
              <p className={styles.scoreLabel}>좋아요</p>
            </div>

            <div className={styles.scoreBox}>
              <div className={styles.smallScore}>
                12<span className={styles.percent}>%</span>
              </div>
              <p className={styles.scoreLabel}>싫어요</p>
            </div>
          </div>
        </section>

        <section className={styles.feedbackListSection}>
          <div className={styles.feedbackRow}>
            <div className={styles.iconCircle}>👍</div>
            <div className={styles.feedbackKeywords}>
              {likeKeywords.map((keyword) => (
                <span key={keyword} className={styles.feedbackChip}>
                  {keyword}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.feedbackRow}>
            <div className={styles.iconCircle}>👎</div>
            <div className={styles.feedbackKeywords}>
              {dislikeKeywords.map((keyword) => (
                <span key={keyword} className={styles.feedbackChip}>
                  {keyword}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.feedbackRow}>
            <div className={styles.iconCircle}>👍</div>
            <div className={styles.feedbackKeywords}>
              {neutralKeywords.map((keyword) => (
                <span key={keyword} className={styles.feedbackChip}>
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className={styles.divider} />

        <section className={styles.itemSection}>
          <div className={styles.itemHeader}>
            <h2 className={styles.sectionTitle}>착용 아이템</h2>
            <button type="button" className={styles.moreButton}>
              더보기 &gt;
            </button>
          </div>

          <div className={styles.itemGrid}>
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

        <div className={styles.bottomSpace} />

        {hasReachedBottom && (
          <div className={styles.autoBackNotice}>
            정보를 모두 확인했어요
            <br />
            {countdown}초 뒤 평가존으로 돌아갑니다
          </div>
        )}
      </div>
    </div>
  );
};

export default EvaluationDetail2;