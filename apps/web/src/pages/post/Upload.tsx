import React, {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import type { CreatePostResponse } from "@codinator/contracts";
import {
  fetcher,
  getAuthHeaders,
  resolveAssetUrl,
  uploadPostImage,
  type UploadedPostImageResponse,
} from "../../lib/api";
import styles from "./Upload.module.css";

type KeywordItem = {
  id: number;
  label: string;
};

type WearType =
  | ""
  | "상의"
  | "하의"
  | "원피스"
  | "아우터"
  | "신발"
  | "가방"
  | "악세사리";

type WearItem = {
  id: number;
  type: WearType;
  brand: string;
  name: string;
  imageUrl?: string;
};

const keywordOptions: KeywordItem[] = [
  { id: 1, label: "스포티하다" },
  { id: 2, label: "힙합적이다" },
  { id: 3, label: "분위기" },
  { id: 4, label: "깔끔하다" },
  { id: 5, label: "스트릿하다" },
  { id: 6, label: "세련됐다" },
  { id: 7, label: "러블리하다" },
  { id: 8, label: "미니멀하다" },
  { id: 9, label: "캐주얼하다" },
  { id: 10, label: "유니크하다" },
];

const wearTypeOptions: WearType[] = [
  "",
  "상의",
  "하의",
  "원피스",
  "아우터",
  "신발",
  "가방",
  "악세사리",
];

const initialWearItems: WearItem[] = [
  { id: 1, type: "", brand: "", name: "" },
  { id: 2, type: "", brand: "", name: "" },
  { id: 3, type: "", brand: "", name: "" },
  { id: 4, type: "", brand: "", name: "" },
];

function BackIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M14.5 6L8.5 12L14.5 18"
        stroke="black"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhotoFrameIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3.5"
        y="5"
        width="17"
        height="14"
        rx="2.5"
        stroke="black"
        strokeWidth="1.8"
      />
      <circle cx="16.8" cy="9.2" r="1.5" fill="black" />
      <path
        d="M6.5 16L10.2 12.4C10.6 12 11.2 12 11.6 12.4L13.6 14.4"
        stroke="black"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.8 14L13.4 12.5C13.8 12.1 14.4 12.1 14.8 12.5L17.5 15.2"
        stroke="black"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function cls(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(" ");
}

export default function Upload() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [content, setContent] = useState("");
  const [message, setMessage] = useState(
    "이미지와 설명을 입력하면 게시글을 등록할 수 있습니다."
  );
  const [submitting, setSubmitting] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedImage, setUploadedImage] =
    useState<UploadedPostImageResponse | null>(null);

  const [imagePreview, setImagePreview] = useState<string>("");
  const [selectedKeywords, setSelectedKeywords] = useState<number[]>([]);
  const [wearItems, setWearItems] = useState<WearItem[]>(initialWearItems);

  const previewUrl = useMemo(() => {
    if (imagePreview) return imagePreview;
    return resolveAssetUrl(uploadedImage?.imageUrl);
  }, [imagePreview, uploadedImage]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setSelectedFile(file);
    setUploadedImage(null);

    if (!file) {
      setImagePreview("");
      setMessage("업로드할 이미지를 선택해주세요.");
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextUrl;
    setImagePreview(nextUrl);
    setMessage(`선택된 파일: ${file.name}`);
  };

  const toggleKeyword = (keywordId: number) => {
    setSelectedKeywords((prev) => {
      const alreadySelected = prev.includes(keywordId);

      if (alreadySelected) {
        return prev.filter((id) => id !== keywordId);
      }

      if (prev.length >= 3) {
        alert("키워드는 최대 3개까지 선택할 수 있습니다.");
        return prev;
      }

      return [...prev, keywordId];
    });
  };

  const handleWearItemChange = (
    itemId: number,
    field: keyof Pick<WearItem, "type" | "brand" | "name">,
    value: string
  ) => {
    setWearItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setMessage("이미지를 먼저 선택해주세요.");
      return;
    }

    if (!content.trim()) {
      setMessage("content를 입력해주세요.");
      return;
    }

    try {
      setSubmitting(true);

      let uploaded = uploadedImage;

      if (!uploaded) {
        setMessage("이미지 업로드 중...");
        uploaded = await uploadPostImage(selectedFile);
        setUploadedImage(uploaded);
      }

      setMessage("게시글 생성 중...");

      await fetcher<CreatePostResponse>("/posts", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          content: content.trim(),
          image: {
            imageUrl: uploaded.imageUrl,
            storageKey: uploaded.storageKey ?? null,
            thumbnailUrl: uploaded.thumbnailUrl ?? null,
          },
          outfitItems: [],
        }),
      });

      setMessage("게시글 생성 완료");
      navigate("/rankingZone");
    } catch (err) {
      console.error("게시글 작성 실패:", err);
      setMessage(err instanceof Error ? err.message : "게시글 작성 실패");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>
        <section className={styles.heroSection}>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="업로드 미리보기"
              className={styles.heroImage}
            />
          ) : (
            <div className={styles.heroPlaceholder}>
              <span className={styles.heroPlaceholderText}>
                선택된 이미지가 없습니다.
              </span>
            </div>
          )}

          <button
            type="button"
            className={styles.headerCircleButton}
            onClick={handleBack}
            aria-label="뒤로가기"
          >
            <BackIcon />
          </button>

          <button
            type="button"
            className={styles.editCircleButton}
            onClick={handleOpenFilePicker}
            aria-label="사진 선택"
          >
            <PhotoFrameIcon />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg"
            className={styles.hiddenInput}
            onChange={handleImageChange}
          />
        </section>

        <section className={styles.contentSection}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>닉네임/ 코드 컨셉</h1>
            <p className={styles.description}>
              코디 설명 자세히
              <br />
              최대 두줄 정도
            </p>
          </div>

          <div className={styles.divider} />

          <section className={styles.contentInputSection}>
            <label htmlFor="post-content" className={styles.contentLabel}>
              게시글 설명
            </label>

            <textarea
              id="post-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="게시글 content를 입력해주세요."
              className={styles.contentTextarea}
              maxLength={300}
            />

            <div className={styles.textMetaRow}>
              <span className={styles.helperText}>
                실제 등록은 이미지 + content만 반영됩니다.
              </span>
              <span className={styles.lengthText}>{content.length}/300</span>
            </div>
          </section>

          <div className={styles.divider} />

          <section className={styles.keywordSection}>
            <div className={styles.keywordHeader}>
              <span className={styles.keywordGuide}>
                키워드 선택 {selectedKeywords.length}/3
              </span>
            </div>

            <div className={styles.keywordGrid}>
              {keywordOptions.map((keyword) => {
                const selected = selectedKeywords.includes(keyword.id);

                return (
                  <button
                    key={keyword.id}
                    type="button"
                    className={cls(
                      styles.keywordChip,
                      selected && styles.keywordChipSelected
                    )}
                    onClick={() => toggleKeyword(keyword.id)}
                  >
                    <span
                      className={cls(
                        styles.keywordThumb,
                        selected && styles.keywordThumbSelected
                      )}
                    />
                    <span className={styles.keywordLabel}>{keyword.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className={styles.divider} />

          <section className={styles.itemSection}>
            <h2 className={styles.sectionTitle}>착용 아이템</h2>

            <div className={styles.itemGrid}>
              {wearItems.map((item) => (
                <article key={item.id} className={styles.itemCard}>
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name || "착용 아이템"}
                      className={styles.itemImage}
                    />
                  ) : (
                    <div className={styles.itemImagePlaceholder} />
                  )}

                  <div className={styles.itemInfo}>
                    <select
                      value={item.type}
                      onChange={(e) =>
                        handleWearItemChange(item.id, "type", e.target.value)
                      }
                      className={styles.itemSelect}
                    >
                      {wearTypeOptions.map((type) => (
                        <option key={type || "empty"} value={type}>
                          {type || "의류 종류 선택"}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={item.brand}
                      onChange={(e) =>
                        handleWearItemChange(item.id, "brand", e.target.value)
                      }
                      placeholder="상품 브랜드"
                      className={styles.itemInput}
                    />

                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) =>
                        handleWearItemChange(item.id, "name", e.target.value)
                      }
                      placeholder="상품 이름"
                      className={styles.itemInput}
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <p className={styles.statusMessage}>{message}</p>

          <div className={styles.submitArea}>
            <button
              type="button"
              className={styles.submitButton}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "처리 중..." : "게시글 작성 완료"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}