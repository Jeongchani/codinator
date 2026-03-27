import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./MyFeedEdit.module.css";

type FeedItem = {
  id: number;
  postId?: number;
  authorId?: number;
  imageUrl: string;
  nickname: string;
  likes?: number;
  dislikes?: number;
  content?: string;
};

type TagItem = {
  id: number;
  label: string;
  selected: boolean;
};

type WearItem = {
  id: number;
  brand: string;
  name: string;
  imageUrl?: string;
};

const initialTags: TagItem[] = [
  { id: 1, label: "스포티", selected: false },
  { id: 2, label: "심플하다", selected: false },
  { id: 3, label: "화려하다", selected: false },
  { id: 4, label: "깔끔하다", selected: true },
  { id: 5, label: "세련됐다", selected: false },
  { id: 6, label: "힙하다", selected: true },
  { id: 7, label: "개성있음", selected: false },
  { id: 8, label: "트렌디함", selected: false },
  { id: 9, label: "무난하다", selected: false },
];

const wearItems: WearItem[] = [
  { id: 1, brand: "상품 브랜드", name: "상품 이름" },
  { id: 2, brand: "상품 브랜드", name: "상품 이름" },
  { id: 3, brand: "상품 브랜드", name: "상품 이름" },
  { id: 4, brand: "상품 브랜드", name: "상품 이름" },
];

export default function MyFeedEdit() {
  const navigate = useNavigate();
  const location = useLocation();
  const post: FeedItem | undefined = location.state?.post;

  const [tags, setTags] = useState<TagItem[]>(initialTags);

  const handleToggleTag = (id: number) => {
    setTags((prev) =>
      prev.map((tag) =>
        tag.id === id ? { ...tag, selected: !tag.selected } : tag
      )
    );
  };

  const handleComplete = () => {
    const resolvedPostId = post?.postId ?? post?.id;

    if (!resolvedPostId) {
      navigate(-1);
      return;
    }

    navigate(`/my-feed-detail/${resolvedPostId}`, {
      state: {
        post,
      },
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>
        <section className={styles.imageSection}>
          <div className={styles.mainImage}>
            {post?.imageUrl && (
              <img
                src={post.imageUrl}
                alt={post.nickname}
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
          <h1 className={styles.title}>
            {post?.nickname ?? "닉네임/ 코드 컨셉"}
          </h1>
          <p className={styles.description}>
            코디설명자세히
            <br />
            최대두줄정도
          </p>
        </section>

        <section className={styles.tagSection}>
          <div className={styles.tagList}>
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleToggleTag(tag.id)}
                className={tag.selected ? styles.tagSelected : styles.tagButton}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </section>

        <div className={styles.divider} />

        <section className={styles.itemSection}>
          <h2 className={styles.sectionTitle}>착용 아이템</h2>

          <div className={styles.itemGrid}>
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

        <div className={styles.bottomButtonWrap}>
          <button
            type="button"
            className={styles.completeButton}
            onClick={handleComplete}
          >
            게시물 수정 완료
          </button>
        </div>
      </div>
    </div>
  );
}