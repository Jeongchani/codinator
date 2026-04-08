import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Undo2 } from "lucide-react";
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

type BlurFlowStep = "idle" | "decision" | "manual";
type BrushTool = "mosaic" | "eraser";

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
    <div className={styles.compareStack}>
      <div className={styles.compareLargePanel}>
        <div className={styles.compareLargeHeader}>
          <span className={styles.compareLargeLabel}>원본</span>
        </div>
        <img src={originalUrl} alt="원본" className={styles.compareLargeImage} />
      </div>

      <div className={styles.compareLargePanel}>
        <div className={styles.compareLargeHeader}>
          <span className={cls(styles.compareLargeLabel, aiFailed && styles.compareLabelError)}>
            AI 블러
          </span>
        </div>

        {aiUrl && !aiFailed ? (
          <img src={aiUrl} alt="AI 블러" className={styles.compareLargeImage} />
        ) : (
          <div className={styles.compareLargePlaceholder}>AI 블러 미처리</div>
        )}
      </div>

      {manualPreview && (
        <div className={styles.compareLargePanel}>
          <div className={styles.compareLargeHeader}>
            <span className={styles.compareLargeLabel}>수동 블러</span>
          </div>
          <img src={manualPreview} alt="수동 블러" className={styles.compareLargeImage} />
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
  const [tool, setTool] = useState<BrushTool>("mosaic");
  const [brushSize, setBrushSize] = useState(52);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [approving, setApproving] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [imageLoadError, setImageLoadError] = useState("");

  const toolRef = useRef<BrushTool>("mosaic");
  const brushRef = useRef(52);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const origCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastCvsPos = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<ImageData[]>([]);

  const changeTool = (nextTool: BrushTool) => {
    toolRef.current = nextTool;
    setTool(nextTool);
  };

  const changeBrush = (nextBrush: number) => {
    brushRef.current = nextBrush;
    setBrushSize(nextBrush);
  };

  useEffect(() => {
    let cancelled = false;

    const sameOriginUrl = originalImageUrl.replace(/^https?:\/\/localhost:\d+/, "");
    const img = new Image();

    img.onload = () => {
      if (cancelled) return;

      const displayCanvas = displayCanvasRef.current;
      const origCanvas = origCanvasRef.current;
      if (!displayCanvas || !origCanvas) return;

      const width = img.naturalWidth;
      const height = img.naturalHeight;

      displayCanvas.width = origCanvas.width = width;
      displayCanvas.height = origCanvas.height = height;

      const displayCtx = displayCanvas.getContext("2d");
      const origCtx = origCanvas.getContext("2d");
      if (!displayCtx || !origCtx) return;

      displayCtx.clearRect(0, 0, width, height);
      origCtx.clearRect(0, 0, width, height);

      displayCtx.drawImage(img, 0, 0);
      origCtx.drawImage(img, 0, 0);

      historyRef.current = [];
      setCanUndo(false);
      setImgLoaded(true);
    };

    img.onerror = () => {
      if (cancelled) return;
      setImageLoadError("원본 이미지를 불러오지 못했습니다.");
    };

    img.src = sameOriginUrl;

    return () => {
      cancelled = true;
    };
  }, [originalImageUrl]);

  const saveSnapshot = () => {
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;

    try {
      const ctx = displayCanvas.getContext("2d");
      if (!ctx) return;

      const snapshot = ctx.getImageData(0, 0, displayCanvas.width, displayCanvas.height);
      historyRef.current.push(snapshot);

      if (historyRef.current.length > 30) {
        historyRef.current.shift();
      }

      setCanUndo(true);
    } catch {
      // no-op
    }
  };

  const handleUndo = () => {
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas || historyRef.current.length === 0) return;

    const ctx = displayCanvas.getContext("2d");
    if (!ctx) return;

    const prev = historyRef.current.pop();
    if (!prev) return;

    ctx.putImageData(prev, 0, 0);
    setCanUndo(historyRef.current.length > 0);
  };

  const applyAt = (cx: number, cy: number, canvasRadius: number) => {
    const displayCanvas = displayCanvasRef.current;
    const origCanvas = origCanvasRef.current;
    if (!displayCanvas || !origCanvas) return;

    const displayCtx = displayCanvas.getContext("2d");
    const origCtx = origCanvas.getContext("2d");
    if (!displayCtx || !origCtx) return;

    const block = Math.max(8, Math.round((canvasRadius / 2) * 0.4));

    const bx1 = Math.max(0, Math.floor((cx - canvasRadius) / block));
    const by1 = Math.max(0, Math.floor((cy - canvasRadius) / block));
    const bx2 = Math.min(
      Math.ceil(displayCanvas.width / block) - 1,
      Math.floor((cx + canvasRadius) / block),
    );
    const by2 = Math.min(
      Math.ceil(displayCanvas.height / block) - 1,
      Math.floor((cy + canvasRadius) / block),
    );

    for (let bx = bx1; bx <= bx2; bx += 1) {
      for (let by = by1; by <= by2; by += 1) {
        const gx = bx * block;
        const gy = by * block;
        const gw = Math.min(block, displayCanvas.width - gx);
        const gh = Math.min(block, displayCanvas.height - gy);

        if (gw <= 0 || gh <= 0) continue;

        if (toolRef.current === "eraser") {
          const imageData = origCtx.getImageData(gx, gy, gw, gh);
          displayCtx.putImageData(imageData, gx, gy);
        } else {
          const srcCanvas = document.createElement("canvas");
          srcCanvas.width = gw;
          srcCanvas.height = gh;

          const srcCtx = srcCanvas.getContext("2d");
          if (!srcCtx) continue;

          srcCtx.putImageData(origCtx.getImageData(gx, gy, gw, gh), 0, 0);

          const onePxCanvas = document.createElement("canvas");
          onePxCanvas.width = 1;
          onePxCanvas.height = 1;

          const onePxCtx = onePxCanvas.getContext("2d");
          if (!onePxCtx) continue;

          onePxCtx.drawImage(srcCanvas, 0, 0, 1, 1);

          displayCtx.imageSmoothingEnabled = false;
          displayCtx.drawImage(onePxCanvas, 0, 0, 1, 1, gx, gy, gw, gh);
          displayCtx.imageSmoothingEnabled = true;
        }
      }
    }
  };

  const interpolate = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    canvasRadius: number,
  ) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const step = Math.max(1, canvasRadius / 2);
    const steps = Math.ceil(distance / step);

    for (let i = 1; i <= steps; i += 1) {
      applyAt(
        from.x + (dx * i) / steps,
        from.y + (dy * i) / steps,
        canvasRadius,
      );
    }
  };

  const toCanvasPosition = (
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
  ) => {
    const rect = canvas.getBoundingClientRect();

    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const toCanvasRadius = (cssRadius: number, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    return cssRadius * (canvas.width / rect.width);
  };

  const stopDrawing = (canvas?: HTMLCanvasElement, pointerId?: number) => {
    if (canvas && pointerId !== undefined && canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
    isDrawing.current = false;
    lastCvsPos.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!imgLoaded) return;

    const canvas = e.currentTarget;
    canvas.setPointerCapture(e.pointerId);

    isDrawing.current = true;
    saveSnapshot();

    const pos = toCanvasPosition(e.clientX, e.clientY, canvas);
    const canvasRadius = toCanvasRadius(brushRef.current / 2, canvas);

    lastCvsPos.current = pos;
    setCursorPos({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });

    applyAt(pos.x, pos.y, canvasRadius);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();

    setCursorPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });

    if (!isDrawing.current || !lastCvsPos.current) return;

    const pos = toCanvasPosition(e.clientX, e.clientY, canvas);
    const canvasRadius = toCanvasRadius(brushRef.current / 2, canvas);

    interpolate(lastCvsPos.current, pos, canvasRadius);
    lastCvsPos.current = pos;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    stopDrawing(e.currentTarget, e.pointerId);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    stopDrawing(e.currentTarget, e.pointerId);
  };

  const handlePointerLeave = () => {
    setCursorPos(null);
  };

  const handleApprove = () => {
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas || !imgLoaded) return;

    setApproving(true);

    const previewDataUrl = displayCanvas.toDataURL("image/jpeg", 0.92);

    displayCanvas.toBlob(
      (blob) => {
        if (!blob) {
          setApproving(false);
          return;
        }

        onApprove(new File([blob], "manual-blur.jpg", { type: "image/jpeg" }), previewDataUrl);
      },
      "image/jpeg",
      0.92,
    );
  };

  const brushPresets = [
    { value: 28, dot: 10 },
    { value: 52, dot: 18 },
    { value: 84, dot: 26 },
  ];

  const toolColor = tool === "mosaic" ? "#2563eb" : "#ef4444";

  return (
    <div className={styles.manualEditorWrap}>
      <div className={styles.manualHeader}>
        <div>
          <h3 className={styles.manualTitle}>수동 블러 편집</h3>
          <p className={styles.manualSubText}>터치하거나 드래그해서 바로 수정</p>
        </div>
      </div>

      <div className={styles.manualControls}>
        <div className={styles.toolSegment}>
          <button
            type="button"
            className={cls(
              styles.toolSegmentButton,
              tool === "mosaic" && styles.toolSegmentButtonActiveBlue,
            )}
            onClick={() => changeTool("mosaic")}
          >
            모자이크
          </button>

          <button
            type="button"
            className={cls(
              styles.toolSegmentButton,
              tool === "eraser" && styles.toolSegmentButtonActiveRed,
            )}
            onClick={() => changeTool("eraser")}
          >
            지우기
          </button>
        </div>

        <button
          type="button"
          className={styles.undoButton}
          onClick={handleUndo}
          disabled={!canUndo}
          aria-label="되돌리기"
        >
          <Undo2 size={18} strokeWidth={2.2} />
          <span>되돌리기</span>
        </button>
      </div>

      <div className={styles.sizeRow}>
        {brushPresets.map((item) => {
          const active = brushSize === item.value;

          return (
            <button
              key={item.value}
              type="button"
              className={cls(styles.sizeDotButton, active && styles.sizeDotButtonActive)}
              onClick={() => changeBrush(item.value)}
              aria-label={`브러시 크기 ${item.value}`}
            >
              <span
                className={styles.sizeDot}
                style={{
                  width: `${item.dot}px`,
                  height: `${item.dot}px`,
                  backgroundColor: active ? toolColor : "#9ca3af",
                }}
              />
            </button>
          );
        })}
      </div>

      {imageLoadError && <p className={styles.editorError}>{imageLoadError}</p>}

      {!imgLoaded && !imageLoadError && (
        <div className={styles.editorLoading}>이미지 불러오는 중...</div>
      )}

      <div
        className={styles.editorCanvasFrame}
        style={{
          display: imgLoaded ? "block" : "none",
          borderColor: toolColor,
        }}
      >
        <div className={styles.editorCanvasInner}>
          <canvas
            ref={displayCanvasRef}
            className={styles.editorCanvas}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerLeave}
          />

          {cursorPos && (
            <div
              className={styles.editorCursor}
              style={{
                left: `${cursorPos.x - brushSize / 2}px`,
                top: `${cursorPos.y - brushSize / 2}px`,
                width: `${brushSize}px`,
                height: `${brushSize}px`,
                borderColor: toolColor,
                background:
                  tool === "mosaic"
                    ? "rgba(37,99,235,0.14)"
                    : "rgba(239,68,68,0.14)",
              }}
            />
          )}
        </div>
      </div>

      <div className={styles.editorHint}>
        <span className={styles.hintBadge}>모자이크</span>
        <span>터치/드래그</span>
        <span className={styles.hintDivider}>·</span>
        <span className={styles.hintBadgeRed}>지우기</span>
        <span>복원</span>
      </div>

      <div className={styles.editorBottomActions}>
        <button
          type="button"
          className={styles.editorApplyButton}
          onClick={handleApprove}
          disabled={!imgLoaded || approving}
        >
          {approving ? "처리 중..." : "이 결과로 사용하기"}
        </button>

        <button type="button" className={styles.editorBackButton} onClick={onBack}>
          <ChevronLeft size={16} strokeWidth={2.2} />
          <span>블러 비교로 돌아가기</span>
        </button>
      </div>

      <canvas ref={origCanvasRef} className={styles.hiddenCanvas} />
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

  const previewUrl = useMemo(() => approvedPreview || "", [approvedPreview]);

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
          (
            item,
          ): item is {
            category: GarmentCategory;
            brand: string | null;
            itemName: string | null;
          } => item.category !== null && Boolean(item.brand || item.itemName),
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
            <ChevronLeft size={22} strokeWidth={2.2} />
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
              사진 선택 후 블러 결과를 확인하고 업로드를 진행하세요.
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
                  블러 결과 다시 보기
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

      {blurDecisionOpen && uploadedImage && (
        <Modal onClose={() => setBlurDecisionOpen(false)}>
          {blurStep === "decision" && (
            <>
              <div className={styles.modalHeaderCompact}>
                <h3 className={styles.modalTitle}>블러 확인</h3>
                <p className={styles.modalDescription}>이미지를 크게 보고 선택하세요.</p>
              </div>

              <ImgCompare
                originalUrl={rawLocalPreview || assetUrl(uploadedImage.originalImageUrl)}
                aiUrl={uploadedImage.processedImageUrl ? assetUrl(uploadedImage.processedImageUrl) : ""}
                aiFailed={uploadedImage.aiBlurStatus === "FAILED"}
                manualPreview={manualPreviewUrl}
              />

              {uploadedImage.aiBlurStatus === "FAILED" ? (
                <p className={styles.modalWarningText}>
                  AI 블러가 실패했어요. 수동 블러로 바로 수정해주세요.
                </p>
              ) : (
                <p className={styles.modalInfoText}>가려짐이 충분하면 AI 블러를 그대로 사용하면 됩니다.</p>
              )}

              <div className={styles.modalButtonColumn}>
                <button
                  type="button"
                  className={styles.modalPrimaryButton}
                  onClick={handleApproveAutoBlur}
                  disabled={uploadedImage.aiBlurStatus === "FAILED"}
                >
                  AI 블러 사용
                </button>

                <button
                  type="button"
                  className={styles.modalSecondaryButton}
                  onClick={handleOpenManualEditor}
                >
                  직접 수정하기
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
            <ManualBlurEditor
              key={rawLocalPreview || assetUrl(uploadedImage.originalImageUrl)}
              originalImageUrl={rawLocalPreview || assetUrl(uploadedImage.originalImageUrl)}
              onApprove={handleManualApprove}
              onBack={() => setBlurStep("decision")}
            />
          )}
        </Modal>
      )}
    </div>
  );
}