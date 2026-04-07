import React, {
  ChangeEvent,
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import type {
  CreatePostResponse,
  GarmentCategory,
  GetKeywordsResponse,
} from "@codinator/contracts";
import {
  clearAuthTokens,
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
  | "아우터"
  | "신발"
  | "가방"
  | "악세사리"
  | "기타";

type WearItem = {
  id: number;
  type: WearType;
  brand: string;
  name: string;
  imageUrl?: string;
};

type BlurRegion = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type InteractionState =
  | { type: "none" }
  | { type: "move"; id: number; startX: number; startY: number; origX: number; origY: number }
  | { type: "resize"; id: number; startX: number; startY: number; origW: number; origH: number };

type BlurFlowStep = "idle" | "decision" | "manual";

const EDITOR_IMG_W = 320;

const wearTypeOptions: WearType[] = [
  "",
  "상의",
  "하의",
  "아우터",
  "신발",
  "가방",
  "악세사리",
  "기타",
];

const initialWearItems: WearItem[] = [
  { id: 1, type: "", brand: "", name: "" },
  { id: 2, type: "", brand: "", name: "" },
  { id: 3, type: "", brand: "", name: "" },
  { id: 4, type: "", brand: "", name: "" },
];

function mapWearTypeToCategory(type: WearType): GarmentCategory | null {
  switch (type) {
    case "상의":
      return "TOP";
    case "하의":
      return "BOTTOM";
    case "아우터":
      return "OUTER";
    case "신발":
      return "SHOES";
    case "가방":
      return "BAG";
    case "악세사리":
      return "ACCESSORY";
    case "기타":
      return "ETC";
    default:
      return null;
  }
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="black" strokeWidth="1.8" />
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

function assetUrl(url: string | null | undefined) {
  if (!url) return "";
  return resolveAssetUrl(url);
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ImgCompare({
  originalUrl,
  aiUrl,
  aiFailed,
  manualPreview,
}: {
  originalUrl: string;
  aiUrl?: string;
  aiFailed?: boolean;
  manualPreview?: string | null;
}) {
  return (
    <div className={cls(styles.compareGrid, manualPreview && styles.compareGridManual)}>
      <div className={styles.comparePanel}>
        <span className={styles.compareLabel}>원본</span>
        <img src={originalUrl} alt="원본" className={styles.compareImage} />
      </div>

      <div className={styles.comparePanel}>
        <span className={cls(styles.compareLabel, aiFailed && styles.compareLabelError)}>
          AI 블러
        </span>
        {aiUrl && !aiFailed ? (
          <img src={aiUrl} alt="AI 블러" className={styles.compareImage} />
        ) : (
          <div className={styles.comparePlaceholder}>블러 미처리</div>
        )}
      </div>

      {manualPreview && (
        <div className={styles.comparePanel}>
          <span className={styles.compareLabel}>수동 블러</span>
          <img src={manualPreview} alt="수동 블러" className={styles.compareImage} />
        </div>
      )}
    </div>
  );
}

function ManualBlurEditor({
  originalImageUrl,
  onApprove,
  onBack,
}: {
  originalImageUrl: string;
  onApprove: (file: File, previewDataUrl: string) => void;
  onBack: () => void;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imageLoadError, setImageLoadError] = useState("");
  const [regions, setRegions] = useState<BlurRegion[]>([
    { id: 1, x: 40, y: 40, width: 100, height: 100 },
  ]);
  const [selectedId, setSelectedId] = useState<number | null>(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const nextId = useRef(2);
  const interaction = useRef<InteractionState>({ type: "none" });

  useEffect(() => {
    setImgLoaded(false);
    setImageLoadError("");
    setPreviewUrl(null);
  }, [originalImageUrl]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const state = interaction.current;
    if (state.type === "none") return;

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;

    if (state.type === "move") {
      setRegions((prev) =>
        prev.map((region) =>
          region.id !== state.id
            ? region
            : {
                ...region,
                x: Math.max(0, Math.min(EDITOR_IMG_W - region.width, state.origX + dx)),
                y: Math.max(0, state.origY + dy),
              },
        ),
      );
    }

    if (state.type === "resize") {
      setRegions((prev) =>
        prev.map((region) =>
          region.id !== state.id
            ? region
            : {
                ...region,
                width: Math.max(30, Math.min(EDITOR_IMG_W - region.x, state.origW + dx)),
                height: Math.max(30, state.origH + dy),
              },
        ),
      );
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    interaction.current = { type: "none" };
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const buildCanvas = () => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return null;

    const displayHeight = EDITOR_IMG_W * (img.naturalHeight / img.naturalWidth);
    const scaleX = img.naturalWidth / EDITOR_IMG_W;
    const scaleY = img.naturalHeight / displayHeight;

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0);

    for (const region of regions) {
      const nx = Math.round(region.x * scaleX);
      const ny = Math.round(region.y * scaleY);
      const nw = Math.max(1, Math.round(region.width * scaleX));
      const nh = Math.max(1, Math.round(region.height * scaleY));

      const pixelBlock = 18;
      const tw = Math.max(1, Math.ceil(nw / pixelBlock));
      const th = Math.max(1, Math.ceil(nh / pixelBlock));

      const temp = document.createElement("canvas");
      temp.width = tw;
      temp.height = th;

      const tctx = temp.getContext("2d");
      if (!tctx) continue;

      tctx.drawImage(img, nx, ny, nw, nh, 0, 0, tw, th);

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(temp, 0, 0, tw, th, nx, ny, nw, nh);
      ctx.imageSmoothingEnabled = true;
    }

    return canvas;
  };

  const handleGeneratePreview = () => {
    setGenerating(true);

    requestAnimationFrame(() => {
      try {
        const canvas = buildCanvas();
        if (!canvas) {
          setGenerating(false);
          return;
        }
        const url = canvas.toDataURL("image/jpeg", 0.92);
        setPreviewUrl(url);
      } catch (err) {
        alert(`미리보기 생성 실패: ${(err as Error).message}`);
      } finally {
        setGenerating(false);
      }
    });
  };

  const handleApprove = async () => {
    if (!previewUrl) return;
    const blob = await fetch(previewUrl).then((res) => res.blob());
    const file = new File([blob], "manual-blur.jpg", { type: "image/jpeg" });
    onApprove(file, previewUrl);
  };

  const addRegion = () => {
    const id = nextId.current++;
    setRegions((prev) => [...prev, { id, x: 50, y: 50, width: 110, height: 110 }]);
    setSelectedId(id);
    setPreviewUrl(null);
  };

  const removeSelected = () => {
    if (selectedId === null) return;
    setRegions((prev) => prev.filter((region) => region.id !== selectedId));
    setSelectedId(null);
    setPreviewUrl(null);
  };

  const handleRegionMouseDown = (e: ReactMouseEvent<HTMLDivElement>, region: BlurRegion) => {
    e.stopPropagation();
    setSelectedId(region.id);
    setPreviewUrl(null);

    interaction.current = {
      type: "move",
      id: region.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: region.x,
      origY: region.y,
    };
  };

  const handleResizeMouseDown = (e: ReactMouseEvent<HTMLDivElement>, region: BlurRegion) => {
    e.stopPropagation();
    setSelectedId(region.id);
    setPreviewUrl(null);

    interaction.current = {
      type: "resize",
      id: region.id,
      startX: e.clientX,
      startY: e.clientY,
      origW: region.width,
      origH: region.height,
    };
  };

  return (
    <div className={styles.manualEditorWrap}>
      <div className={styles.manualToolbar}>
        <button type="button" className={styles.editorGhostButton} onClick={addRegion}>
          박스 추가
        </button>

        <button
          type="button"
          className={styles.editorGhostButton}
          onClick={removeSelected}
          disabled={selectedId === null}
        >
          선택 박스 삭제
        </button>

        <button
          type="button"
          className={styles.editorPrimaryButton}
          onClick={handleGeneratePreview}
          disabled={regions.length === 0 || generating || !imgLoaded}
        >
          {generating ? "생성 중..." : "미리보기 생성"}
        </button>
      </div>

      {imageLoadError && <p className={styles.editorError}>{imageLoadError}</p>}

      <div className={styles.editorStage}>
        <div className={styles.editorCanvasWrap}>
          <img
            ref={imgRef}
            src={originalImageUrl}
            alt="수동 블러 편집"
            className={styles.editorBaseImage}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImageLoadError("원본 이미지를 불러오지 못했습니다.")}
          />

          {imgLoaded &&
            regions.map((region) => {
              const selected = selectedId === region.id;

              return (
                <div
                  key={region.id}
                  className={cls(styles.blurBox, selected && styles.blurBoxSelected)}
                  style={{
                    left: `${region.x}px`,
                    top: `${region.y}px`,
                    width: `${region.width}px`,
                    height: `${region.height}px`,
                  }}
                  onMouseDown={(e) => handleRegionMouseDown(e, region)}
                >
                  <span className={styles.blurBoxIndex}>{region.id}</span>
                  <div
                    className={styles.blurBoxHandle}
                    onMouseDown={(e) => handleResizeMouseDown(e, region)}
                  />
                </div>
              );
            })}
        </div>
      </div>

      {previewUrl && (
        <div className={styles.manualPreviewSection}>
          <span className={styles.manualPreviewLabel}>수동 블러 미리보기</span>
          <img src={previewUrl} alt="수동 블러 미리보기" className={styles.manualPreviewImage} />
        </div>
      )}

      <div className={styles.editorBottomActions}>
        <button
          type="button"
          className={styles.editorPrimaryButton}
          onClick={handleApprove}
          disabled={!previewUrl}
        >
          이 결과로 사용하기
        </button>

        <button type="button" className={styles.editorGhostButton} onClick={onBack}>
          뒤로가기
        </button>
      </div>
    </div>
  );
}

export default function Upload() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [content, setContent] = useState("");
  const [message, setMessage] = useState("이미지와 설명을 입력하면 게시글을 등록할 수 있습니다.");
  const [submitting, setSubmitting] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedImage, setUploadedImage] = useState<UploadedPostImageResponse | null>(null);
  const [keywordOptions, setKeywordOptions] = useState<KeywordItem[]>([]);

  const [rawLocalPreview, setRawLocalPreview] = useState("");
  const [approvedPreview, setApprovedPreview] = useState("");
  const [selectedKeywords, setSelectedKeywords] = useState<number[]>([]);
  const [wearItems, setWearItems] = useState<WearItem[]>(initialWearItems);

  const [blurStep, setBlurStep] = useState<BlurFlowStep>("idle");
  const [blurDecisionOpen, setBlurDecisionOpen] = useState(false);
  const [manualPreviewUrl, setManualPreviewUrl] = useState<string | null>(null);
  const [manualBlurFile, setManualBlurFile] = useState<File | null>(null);
  const [approvedBlurMode, setApprovedBlurMode] = useState<"AUTO" | "MANUAL" | null>(null);

  const previewUrl = useMemo(() => {
    return approvedPreview || "";
  }, [approvedPreview]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const resetBlurState = () => {
    setUploadedImage(null);
    setBlurStep("idle");
    setBlurDecisionOpen(false);
    setManualPreviewUrl(null);
    setManualBlurFile(null);
    setApprovedBlurMode(null);
    setApprovedPreview("");
  };

  const handleAuthError = (err: unknown) => {
    const errorMessage = err instanceof Error ? err.message : "요청 처리 실패";

    if (
      errorMessage.includes("Unauthorized") ||
      errorMessage.includes("로그인이 필요합니다") ||
      errorMessage.includes("유효하지 않거나 만료된 토큰")
    ) {
      clearAuthTokens();
      navigate("/login");
      return true;
    }

    return false;
  };

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setSelectedFile(file);
    resetBlurState();

    if (!file) {
      setRawLocalPreview("");
      setMessage("업로드할 이미지를 선택해주세요.");
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextUrl;
    setRawLocalPreview(nextUrl);

    try {
      setSubmitting(true);
      setMessage("AI 얼굴 블러 처리 중...");

      const uploaded = await uploadPostImage(file);
      setUploadedImage(uploaded);
      setBlurStep("decision");
      setBlurDecisionOpen(true);

      if (uploaded.aiBlurStatus === "FAILED") {
        setMessage("AI 블러에 실패했습니다. 수동 블러를 진행해주세요.");
      } else {
        setMessage("AI 블러 결과를 확인해주세요.");
      }
    } catch (err) {
      console.error("이미지 업로드 실패:", err);
      if (handleAuthError(err)) return;
      setMessage(err instanceof Error ? err.message : "이미지 업로드 실패");
    } finally {
      setSubmitting(false);
    }
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
    value: string,
  ) => {
    setWearItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  };

  const handleApproveAutoBlur = () => {
    if (!uploadedImage) return;

    setApprovedBlurMode("AUTO");
    setApprovedPreview(resolveAssetUrl(uploadedImage.processedImageUrl || uploadedImage.originalImageUrl));
    setBlurDecisionOpen(false);
    setBlurStep("idle");
    setMessage("AI 블러 결과가 적용되었습니다.");
  };

  const handleOpenManualEditor = () => {
    setBlurStep("manual");
  };

  const handleManualApprove = (file: File, previewDataUrl: string) => {
    setManualBlurFile(file);
    setManualPreviewUrl(previewDataUrl);
    setApprovedBlurMode("MANUAL");
    setApprovedPreview(previewDataUrl);
    setBlurDecisionOpen(false);
    setBlurStep("idle");
    setMessage("수동 블러가 적용되었습니다.");
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setMessage("이미지를 먼저 선택해주세요.");
      return;
    }

    if (!approvedBlurMode || !uploadedImage) {
      setMessage("먼저 블러 확인을 완료해주세요.");
      setBlurDecisionOpen(true);
      setBlurStep("decision");
      return;
    }

    if (!content.trim()) {
      setMessage("게시글 설명을 입력해주세요.");
      return;
    }

    try {
      setSubmitting(true);

      const outfitItems = wearItems
        .map((item) => ({
          category: mapWearTypeToCategory(item.type),
          brand: item.brand.trim() || null,
          itemName: item.name.trim() || null,
        }))
        .filter(
          (item): item is { category: GarmentCategory; brand: string | null; itemName: string | null } =>
            item.category !== null && Boolean(item.brand || item.itemName),
        );

      setMessage("게시글 생성 중...");

      const created = await fetcher<CreatePostResponse & { postId?: number }>("/posts", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          content: content.trim(),
          image: {
            originalImageUrl: uploadedImage.originalImageUrl,
            processedImageUrl:
              approvedBlurMode === "MANUAL"
                ? uploadedImage.originalImageUrl
                : uploadedImage.processedImageUrl,
            storageKey: uploadedImage.storageKey ?? null,
            thumbnailUrl: uploadedImage.thumbnailUrl ?? null,
            blurMethod: approvedBlurMode === "MANUAL" ? "MANUAL" : uploadedImage.blurMethod,
            aiBlurStatus: uploadedImage.aiBlurStatus,
          },
          keywordIds: selectedKeywords,
          outfitItems,
        }),
      });

      const postId =
        created.postId ??
        (created as unknown as { item?: { postId?: number } }).item?.postId;

      if (approvedBlurMode === "MANUAL" && manualBlurFile && postId) {
        setMessage("수동 블러 서버 반영 중...");

        const formData = new FormData();
        formData.append("file", manualBlurFile);

        const response = await fetch(`/api/v2/uploads/posts/${postId}/manual-blur`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken") ?? ""}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "수동 블러 반영 실패");
        }
      }

      setMessage("게시글 생성 완료");
      navigate("/rankingZone");
    } catch (err) {
      console.error("게시글 작성 실패:", err);
      if (handleAuthError(err)) return;
      setMessage(err instanceof Error ? err.message : "게시글 작성 실패");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const loadKeywords = async () => {
      try {
        const data = await fetcher<GetKeywordsResponse>("/keywords", {
          headers: getAuthHeaders(),
        });

        setKeywordOptions((data.items ?? []).map((item) => ({ id: item.id, label: item.label })));
      } catch (err) {
        if (handleAuthError(err)) return;
        console.error("키워드 불러오기 실패:", err);
      }
    };

    void loadKeywords();

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, [navigate]);

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>
        <section className={styles.heroSection}>
          {previewUrl ? (
            <img src={previewUrl} alt="업로드 미리보기" className={styles.heroImage} />
          ) : (
            <div className={styles.heroPlaceholder}>
              <span className={styles.heroPlaceholderText}>블러 승인된 이미지가 여기에 표시됩니다.</span>
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
            <h1 className={styles.title}>코디 업로드</h1>
            <p className={styles.description}>
              사진 선택 후 먼저 AI 블러 결과를 확인합니다.
              <br />
              마음에 들지 않으면 수동 블러로 직접 수정할 수 있습니다.
            </p>
          </div>

          <div className={styles.divider} />

          {approvedBlurMode && (
            <>
              <div className={styles.blurApprovedText}>
                현재 적용: {approvedBlurMode === "AUTO" ? "AI 자동 블러" : "수동 블러"}
              </div>
              <div className={styles.blurActionArea}>
                <button
                  type="button"
                  className={styles.blurCheckButton}
                  onClick={() => {
                    if (!uploadedImage) return;
                    setBlurDecisionOpen(true);
                    setBlurStep("decision");
                  }}
                >
                  블러 결과 다시 확인
                </button>
              </div>
              <div className={styles.divider} />
            </>
          )}

          <section className={styles.contentInputSection}>
            <label htmlFor="post-content" className={styles.contentLabel}>
              게시글 설명
            </label>

            <textarea
              id="post-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="게시글 설명을 입력해주세요."
              className={styles.contentTextarea}
              maxLength={300}
            />

            <div className={styles.textMetaRow}>
              <span className={styles.helperText}>이미지 1장과 설명은 필수입니다.</span>
              <span className={styles.lengthText}>{content.length}/300</span>
            </div>
          </section>

          <div className={styles.divider} />

          <section className={styles.keywordSection}>
            <div className={styles.keywordHeader}>
              <span className={styles.keywordGuide}>키워드 선택 {selectedKeywords.length}/3</span>
            </div>

            <div className={styles.keywordGrid}>
              {keywordOptions.length > 0 ? (
                keywordOptions.map((keyword) => {
                  const selected = selectedKeywords.includes(keyword.id);

                  return (
                    <button
                      key={keyword.id}
                      type="button"
                      className={cls(styles.keywordChip, selected && styles.keywordChipSelected)}
                      onClick={() => toggleKeyword(keyword.id)}
                    >
                      <span className={cls(styles.keywordThumb, selected && styles.keywordThumbSelected)} />
                      <span className={styles.keywordLabel}>{keyword.label}</span>
                    </button>
                  );
                })
              ) : (
                <p className={styles.statusMessage}>키워드 목록을 불러오지 못했습니다.</p>
              )}
            </div>
          </section>

          <div className={styles.divider} />

          <section className={styles.itemSection}>
            <h2 className={styles.sectionTitle}>착용 아이템</h2>

            <div className={styles.itemGrid}>
              {wearItems.map((item) => (
                <article key={item.id} className={styles.itemCard}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name || "착용 아이템"} className={styles.itemImage} />
                  ) : (
                    <div className={styles.itemImagePlaceholder} />
                  )}

                  <div className={styles.itemInfo}>
                    <select
                      value={item.type}
                      onChange={(e) => handleWearItemChange(item.id, "type", e.target.value)}
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
                      onChange={(e) => handleWearItemChange(item.id, "brand", e.target.value)}
                      placeholder="상품 브랜드"
                      className={styles.itemInput}
                    />

                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleWearItemChange(item.id, "name", e.target.value)}
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
            <button type="button" className={styles.submitButton} onClick={handleSubmit} disabled={submitting}>
              {submitting ? "처리 중..." : "게시글 작성 완료"}
            </button>
          </div>
        </section>
      </div>

      {blurDecisionOpen && uploadedImage && (
        <Modal onClose={() => setBlurDecisionOpen(false)}>
          {blurStep === "decision" && (
            <>
              <div className={styles.modalTitleBlock}>
                <h3 className={styles.modalTitle}>블러 처리 결과 확인</h3>
                <p className={styles.modalDescription}>
                  AI가 얼굴 블러를 적용했습니다. 괜찮으면 그대로 사용하고,
                  마음에 들지 않으면 수동 블러로 직접 수정하세요.
                </p>
              </div>

              <ImgCompare
                originalUrl={rawLocalPreview || assetUrl(uploadedImage.originalImageUrl)}
                aiUrl={uploadedImage.processedImageUrl ? assetUrl(uploadedImage.processedImageUrl) : ""}
                aiFailed={uploadedImage.aiBlurStatus === "FAILED"}
                manualPreview={manualPreviewUrl}
              />

              {uploadedImage.aiBlurStatus === "FAILED" ? (
                <p className={styles.modalWarningText}>
                  AI 블러가 실패했습니다. 수동 블러로 얼굴 영역을 직접 지정해주세요.
                </p>
              ) : (
                <p className={styles.modalInfoText}>
                  얼굴이 충분히 가려졌다면 자동 블러를 승인하면 됩니다.
                </p>
              )}

              <div className={styles.modalButtonColumn}>
                <button
                  type="button"
                  className={styles.modalPrimaryButton}
                  onClick={handleApproveAutoBlur}
                  disabled={uploadedImage.aiBlurStatus === "FAILED"}
                >
                  자동 블러 승인
                </button>

                <button
                  type="button"
                  className={styles.modalSecondaryButton}
                  onClick={handleOpenManualEditor}
                >
                  수동 블러로 수정하기
                </button>

                <button
                  type="button"
                  className={styles.modalGhostButton}
                  onClick={() => setBlurDecisionOpen(false)}
                >
                  닫기
                </button>
              </div>
            </>
          )}

          {blurStep === "manual" && (
            <>
              <div className={styles.modalTitleBlock}>
                <h3 className={styles.modalTitle}>수동 블러 편집</h3>
                <p className={styles.modalDescription}>
                  얼굴 위치에 박스를 올리고 미리보기를 만든 뒤 적용해주세요.
                </p>
              </div>

              <ManualBlurEditor
                originalImageUrl={rawLocalPreview || assetUrl(uploadedImage.originalImageUrl)}
                onApprove={handleManualApprove}
                onBack={() => setBlurStep("decision")}
              />
            </>
          )}
        </Modal>
      )}
    </div>
  );
}