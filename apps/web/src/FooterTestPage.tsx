import { Search, Bookmark, ThumbsUp, ThumbsDown } from "lucide-react";
import Header from "../../web/src/components/Header";
import Footer from "../../web/src/components/Footer";
import styles from "./FooterTestPage.module.css";
import { useState } from "react";

type TestCard = {
  id: number;
  title: string;
  likeCount: number;
  dislikeCount: number;
  bookmarked: boolean;
};

const testSections = [
  {
    title: "This Week",
    items: Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      title: "게시글 컨셉 글\n최대 두줄 혹은 닉네임?",
      likeCount: 3,
      dislikeCount: 0,
      bookmarked: i % 2 === 0,
    })),
  },
  {
    title: "This Month",
    items: Array.from({ length: 10 }, (_, i) => ({
      id: i + 101,
      title: "게시글 컨셉 글\n최대 두줄 혹은 닉네임?",
      likeCount: 3,
      dislikeCount: 0,
      bookmarked: i % 3 === 0,
    })),
  },
  {
    title: "More",
    items: Array.from({ length: 8 }, (_, i) => ({
      id: i + 201,
      title: "게시글 컨셉 글\n최대 두줄 혹은 닉네임?",
      likeCount: 3,
      dislikeCount: 0,
      bookmarked: i % 2 === 1,
    })),
  },
];

export default function FooterTestPage() {
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

  return (
    <div className={styles.container}>
      <Header onMenuClick={() => setIsSideMenuOpen((prev) => !prev)} />

      <div className={styles.contentArea}>
        <div className={styles.searchBox}>
          <Search size={18} strokeWidth={2} className={styles.searchIcon} />
          <span className={styles.searchText}>검색하기</span>
        </div>

        {testSections.map((section) => (
          <section key={section.title} className={styles.section}>
            <h2 className={styles.sectionTitle}>{section.title}</h2>

            <div className={styles.horizontalScroll}>
              {section.items.map((item: TestCard) => (
                <article key={item.id} className={styles.card}>
                  <div className={styles.thumbnail}>
                    <div className={styles.cardImageFallback}>이미지 없음</div>
                    <div className={styles.thumbnailGradient} />

                    <button
                      type="button"
                      className={styles.bookmarkButton}
                      aria-label="북마크"
                    >
                      <Bookmark
                        size={16}
                        strokeWidth={2.2}
                        className={
                          item.bookmarked
                            ? styles.bookmarkFilled
                            : styles.bookmarkDefault
                        }
                        fill={item.bookmarked ? "currentColor" : "none"}
                      />
                    </button>
                  </div>

                  <p className={styles.cardTitle}>
                    {item.title.split("\n").map((line, index, arr) => (
                      <span key={`${item.id}-${index}`}>
                        {line}
                        {index < arr.length - 1 && <br />}
                      </span>
                    ))}
                  </p>

                  <div className={styles.statsRow}>
                    <div className={styles.statItem}>
                      <ThumbsUp
                        size={13}
                        strokeWidth={2}
                        className={styles.statIcon}
                      />
                      <span className={styles.statText}>
                        {String(item.likeCount).padStart(3, "0")}
                      </span>
                    </div>

                    <div className={styles.statItem}>
                      <ThumbsDown
                        size={13}
                        strokeWidth={2}
                        className={styles.statIcon}
                      />
                      <span className={styles.statText}>
                        {String(item.dislikeCount).padStart(3, "0")}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {isSideMenuOpen && (
        <div
          className={styles.sideMenuOverlay}
          onClick={() => setIsSideMenuOpen(false)}
        >
          <div
            className={styles.sideMenuDummy}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.sideMenuTitle}>SideMenu 연결 예정</div>
            <button
              type="button"
              className={styles.sideMenuCloseButton}
              onClick={() => setIsSideMenuOpen(false)}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <div className={styles.footerWrap}>
        <Footer />
      </div>
    </div>
  );
}