import { useLocation, useNavigate } from "react-router-dom";
import styles from "./MyFeedDetail.module.css";
import { ChevronLeft, ChevronRight, Pencil, ThumbsDown, ThumbsUp } from "lucide-react";

type FeedItem = {
  id: number;
  imageUrl: string;
  nickname: string;
  likes: number;
  dislikes: number;
};

type FeedbackGroup = {
  type: "like" | "dislike";
  keywords: string[];
};

type WearItem = {
  id: number;
  brand: string;
  name: string;
  imageUrl?: string;
};

const conceptKeywords = ["#키워드", "#키워드", "#키워드", "#키워드", "#키워드"];

const feedbackGroups: FeedbackGroup[] = [
  {
    type: "like",
    keywords: ["#키워드", "#키워드", "#키워드"],
  },
  {
    type: "dislike",
    keywords: ["#키워드", "#키워드", "#키워드"],
  },
  {
    type: "like",
    keywords: ["#키워드", "#키워드", "#키워드"],
  },
];

const wearItems: WearItem[] = [
  { id: 1, brand: "상품 브랜드", name: "상품 이름" },
  { id: 2, brand: "상품 브랜드", name: "상품 이름" },
  { id: 3, brand: "상품 브랜드", name: "상품 이름" },
];

export default function MyFeedDetail() {
  const navigate = useNavigate();
  const location = useLocation();

  const post: FeedItem | undefined = location.state?.post;

  const likePercent = 89;
  const dislikePercent = 24;

  const handleMoveEdit = () => {
    navigate("/my-feed-edit", {
      state: {
        post,
      },
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>
        <section className={styles.heroSection}>
          <div className={styles.heroImage}>
            {post?.imageUrl && (
              <img
                src={post.imageUrl}
                alt={post.nickname}
                className={styles.heroImageTag}
              />
            )}

            <button
              type="button"
              className={styles.backButton}
              aria-label="뒤로가기"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft size={18} strokeWidth={2.25} />
            </button>

          </div>
        </section>

        <section className={styles.infoSection}>
          <div className={styles.infoText}>
            <h1 className={styles.title}>{post?.nickname ?? "닉네임/ 코드 컨셉"}</h1>
            <p className={styles.description}>
              코디설명자세히
              <br />
              최대두줄정도
            </p>
          </div>

          <button
            type="button"
            className={styles.editButton}
            onClick={handleMoveEdit}
          >
            수정하기
          </button>
        </section>

        <section className={styles.keywordSection}>
          <div className={styles.keywordRow}>
            {conceptKeywords.map((keyword, index) => (
              <span key={`${keyword}-${index}`} className={styles.conceptChip}>
                {keyword}
              </span>
            ))}
          </div>
        </section>

        <div className={styles.divider} />

        <section className={styles.feedbackScoreSection}>
          <h2 className={styles.sectionTitle}>내가 받은 피드백 수치</h2>

          <div className={styles.scoreBlock}>
            <div className={styles.likeRow}>
              <div className={styles.likeBarTrack}>
                <div
                  className={styles.likeBarFill}
                  style={{ width: `${likePercent}%` }}
                />
              </div>
              <div className={styles.likePercent}>
                <span className={styles.likePercentNumber}>{likePercent}</span>
                <span className={styles.likePercentUnit}>%</span>
              </div>
            </div>

            <div className={styles.dislikeRow}>
              <div className={styles.dislikeBarTrack}>
                <div
                  className={styles.dislikeBarFill}
                  style={{ width: `${dislikePercent}%` }}
                />
              </div>
              <span className={styles.dislikePercent}>{dislikePercent}%</span>
            </div>
          </div>
        </section>

        <section className={styles.feedbackKeywordSection}>
          <h2 className={styles.sectionTitle}>내가 받은 피드백 키워드</h2>

          <div className={styles.feedbackList}>
            {feedbackGroups.map((group, index) => (
              <div key={index} className={styles.feedbackItem}>
                <div className={styles.feedbackIconWrap}>
                  {group.type === "like" ? (
                    <ThumbsUp size={14} strokeWidth={2.2} />
                  ) : (
                    <ThumbsDown size={14} strokeWidth={2.2} />
                  )}
                </div>

                <div className={styles.feedbackChips}>
                  {group.keywords.map((keyword, keywordIndex) => (
                    <span
                      key={`${keyword}-${keywordIndex}`}
                      className={styles.feedbackChip}
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className={styles.divider} />

        <section className={styles.itemSection}>
          <div className={styles.itemHeader}>
            <h2 className={styles.sectionTitle}>착용 아이템</h2>

            <button type="button" className={styles.moreButton}>
              <span>더보기</span>
              <ChevronRight size={13} strokeWidth={2.2} />
            </button>
          </div>

          <div className={styles.itemScroller}>
            {wearItems.map((item) => (
              <article key={item.id} className={styles.itemCard}>
                <div className={styles.itemImage}>
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className={styles.itemImageTag}
                    />
                  ) : null}
                </div>

                <div className={styles.itemInfo}>
                  <p className={styles.itemBrand}>{item.brand}</p>
                  <p className={styles.itemName}>{item.name}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}