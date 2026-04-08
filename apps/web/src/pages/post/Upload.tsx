import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Sparkles, Undo2, X } from "lucide-react";
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
};

type BlurFlowStep = "idle" | "decision" | "manual";
type BrushTool = "blur" | "eraser";

type BrushPreset = {
  id: "s" | "m" | "l";
  size: number;
  dot: number;
  block: number;
};

const BRUSH_PRESETS: BrushPreset[] = [
  { id: "s", size: 28, dot: 10, block: 18 },
  { id: "m", size: 52, dot: 18, block: 18 },
  { id: "l", size: 84, dot: 26, block: 18 },
];

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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3.5"
        y="5"
        width="17"
        height="14"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="16.8" cy="9.2" r="1.5" fill="currentColor" />
      <path
        d="M6.5 16L10.2 12.4C10.6 12 11.2 12 11.6 12.4L13.6 14.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.8 14L13.4 12.5C13.8 12.1 14.4 12.1 14.8 12.5L17.5 15.2"
        stroke="currentColor"
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

function CompareImage({
  label,
  imageUrl,
  ai,
}: {
  label: string;
  imageUrl: string;
  ai?: boolean;
}) {
  return (
    <div className={styles.compareImageWrap}>
      <div className={styles.compareFloatingLabel}>
        {ai ? <Sparkles size={14} strokeWidth={2.1} /> : null}
        <span>{label}</span>
      </div>
      <img src={imageUrl} alt={label} className={styles.compareOnlyImage} />
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
      <CompareImage label="원본" imageUrl={originalUrl} />

      <div className={styles.compareDivider} />

      {aiUrl && !aiFailed ? (
        <CompareImage label="AI 블러" imageUrl={aiUrl} ai />
      ) : (
        <div className={styles.compareImageWrap}>
          <div className={styles.compareFloatingLabel}>
            <Sparkles size={14} strokeWidth={2.1} />
            <span>AI 블러</span>
          </div>
          <div className={styles.comparePlaceholder}>AI 블러 미처리</div>
        </div>
      )}

      {manualPreview && (
        <>
          <div className={styles.compareDivider} />
          <CompareImage label="수동 블러" imageUrl={manualPreview} />
        </>
      )}
    </div>
  );
}

function buildPixelatedCanvas(sourceCanvas: HTMLCanvasElement, block: number) {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  const scaledCanvas = document.createElement("canvas");
  scaledCanvas.width = Math.max(1, Math.ceil(width / block));
  scaledCanvas.height = Math.max(1, Math.ceil(height / block));

  const scaledCtx = scaledCanvas.getContext("2d");
  if (!scaledCtx) return null;

  scaledCtx.drawImage(sourceCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);

  const resultCanvas = document.createElement("canvas");
  resultCanvas.width = width;
  resultCanvas.height = height;

  const resultCtx = resultCanvas.getContext("2d");
  if (!resultCtx) return null;

  resultCtx.imageSmoothingEnabled = false;
  resultCtx.drawImage(
    scaledCanvas,
    0,
    0,
    scaledCanvas.width,
    scaledCanvas.height,
    0,
    0,
    width,
    height,
  );
  resultCtx.imageSmoothingEnabled = true;

  return resultCanvas;
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
  const [tool, setTool] = useState<BrushTool>("blur");
  const [brushSize, setBrushSize] = useState(BRUSH_PRESETS[1].size);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [approving, setApproving] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [imageLoadError, setImageLoadError] = useState("");

  const toolRef = useRef<BrushTool>("blur");
  const brushRef = useRef(BRUSH_PRESETS[1].size);

  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const origCanvasRef = useRef<HTMLCanvasElement>(null);
  const mosaicCacheRef = useRef<Map<number, HTMLCanvasElement>>(new Map());

  const isDrawing = useRef(false);
  const lastCvsPos = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<ImageData[]>([]);

  const pendingPointRef = useRef<{ x: number; y: number; canvas: HTMLCanvasElement } | null>(null);
  const rafRef = useRef<number | null>(null);

  const getCurrentPreset = () =>
    BRUSH_PRESETS.find((preset) => preset.size === brushRef.current) ?? BRUSH_PRESETS[1];

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

      mosaicCacheRef.current.clear();
      for (const preset of BRUSH_PRESETS) {
        const cached = buildPixelatedCanvas(origCanvas, preset.block);
        if (cached) {
          mosaicCacheRef.current.set(preset.block, cached);
        }
      }

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
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
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

      if (historyRef.current.length > 20) {
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

  const applyAt = (cx: number, cy: number, canvasRadius: number, canvas: HTMLCanvasElement) => {
    const displayCanvas = displayCanvasRef.current;
    const origCanvas = origCanvasRef.current;
    if (!displayCanvas || !origCanvas) return;

    const displayCtx = displayCanvas.getContext("2d");
    if (!displayCtx) return;

    const currentPreset = getCurrentPreset();
    const block = currentPreset.block;

    const blurSource = mosaicCacheRef.current.get(block);
    const sourceCanvas = toolRef.current === "blur" ? blurSource : origCanvas;
    if (!sourceCanvas) return;

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

        displayCtx.drawImage(sourceCanvas, gx, gy, gw, gh, gx, gy, gw, gh);
      }
    }
  };

  const interpolate = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    canvasRadius: number,
    canvas: HTMLCanvasElement,
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
        canvas,
      );
    }
  };

  const flushPendingDraw = () => {
    const pending = pendingPointRef.current;
    if (!pending || !lastCvsPos.current) {
      rafRef.current = null;
      return;
    }

    const canvasRadius = toCanvasRadius(brushRef.current / 2, pending.canvas);
    interpolate(lastCvsPos.current, pending, canvasRadius, pending.canvas);
    lastCvsPos.current = { x: pending.x, y: pending.y };
    pendingPointRef.current = null;
    rafRef.current = null;
  };

  const scheduleDraw = () => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(flushPendingDraw);
  };

  const stopDrawing = (canvas?: HTMLCanvasElement, pointerId?: number) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (pendingPointRef.current && lastCvsPos.current) {
      const pending = pendingPointRef.current;
      const canvasRadius = toCanvasRadius(brushRef.current / 2, pending.canvas);
      interpolate(lastCvsPos.current, pending, canvasRadius, pending.canvas);
      lastCvsPos.current = { x: pending.x, y: pending.y };
      pendingPointRef.current = null;
    }

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

    applyAt(pos.x, pos.y, canvasRadius, canvas);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();

    setCursorPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });

    if (!isDrawing.current || !lastCvsPos.current) return;

    pendingPointRef.current = {
      ...toCanvasPosition(e.clientX, e.clientY, canvas),
      canvas,
    };

    scheduleDraw();
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

  const toolColor = tool === "blur" ? "#2563eb" : "#ef4444";

  return (
    <div className={styles.manualEditorWrap}>
      <div className={styles.manualHeaderRow}>
        <div className={styles.manualHeaderText}>
          <h3 className={styles.manualTitle}>수동 블러 편집</h3>
          <p className={styles.manualSubText}>터치하거나 드래그해서 바로 수정</p>
        </div>

        <button
          type="button"
          className={styles.manualTopBackButton}
          onClick={onBack}
          aria-label="블러 확인으로 돌아가기"
        >
          <ChevronLeft size={18} strokeWidth={2.8} />
        </button>
      </div>

      <div className={styles.manualToolbar}>
        <button
          type="button"
          className={cls(styles.toolButton, tool === "blur" && styles.toolButtonBlue)}
          onClick={() => changeTool("blur")}
        >
          블러
        </button>

        <button
          type="button"
          className={cls(styles.toolButton, tool === "eraser" && styles.toolButtonRed)}
          onClick={() => changeTool("eraser")}
        >
          지우개
        </button>

        <div className={styles.sizeGroup}>
          <div className={styles.sizeDots}>
            {BRUSH_PRESETS.map((preset) => {
              const active = brushSize === preset.size;

              return (
                <button
                  key={preset.id}
                  type="button"
                  className={cls(styles.sizeDotButton, active && styles.sizeDotButtonActive)}
                  onClick={() => changeBrush(preset.size)}
                  aria-label={`블러 크기 ${preset.id}`}
                >
                  <span
                    className={styles.sizeDot}
                    style={{
                      width: `${preset.dot}px`,
                      height: `${preset.dot}px`,
                      backgroundColor: active ? toolColor : "#9ca3af",
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          className={styles.undoIconButton}
          onClick={handleUndo}
          disabled={!canUndo}
          aria-label="되돌리기"
        >
          <Undo2 size={18} strokeWidth={2.2} />
        </button>
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
                  tool === "blur"
                    ? "rgba(37,99,235,0.14)"
                    : "rgba(239,68,68,0.14)",
              }}
            />
          )}
        </div>
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

  const visibleStatusMessage =
    message &&
    message !== "이미지와 설명을 입력하면 게시글을 등록할 수 있습니다." &&
    message !== "AI 블러 결과가 적용되었습니다." &&
    message !== "수동 블러가 적용되었습니다."
      ? message
      : "";

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

  const handleAddWearItem = () => {
    setWearItems((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((item) => item.id)) + 1 : 1;

      return [
        ...prev,
        {
          id: nextId,
          type: "",
          brand: "",
          name: "",
        },
      ];
    });
  };

  const handleApproveAutoBlur = () => {
    if (!uploadedImage) return;

    setApprovedBlurMode("AUTO");
    setApprovedPreview(resolveAssetUrl(uploadedImage.processedImageUrl || uploadedImage.originalImageUrl));
    setBlurDecisionOpen(false);
    setBlurStep("idle");
    setMessage("");
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
    setMessage("");
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
          <div className={styles.heroMediaFrame}>
            {previewUrl ? (
              <img src={previewUrl} alt="업로드 미리보기" className={styles.heroImage} />
            ) : (
              <div className={styles.heroPlaceholder}>
                <span className={styles.heroPlaceholderText}>
                  블러 승인된 이미지가 여기에 표시됩니다.
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            className={styles.headerCircleButton}
            onClick={handleBack}
            aria-label="뒤로가기"
          >
            <ChevronLeft size={16} strokeWidth={2.8} />
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
          {uploadedImage && (
            <>
              <div className={styles.blurActionArea}>
                <button
                  type="button"
                  className={styles.blurCheckButton}
                  onClick={() => {
                    setBlurDecisionOpen(true);
                    setBlurStep("decision");
                  }}
                >
                  블러 다시 처리하기
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
              placeholder="코디 컨셉을 타이핑"
              className={styles.contentTextarea}
              maxLength={300}
            />

            <div className={styles.textMetaRow}>
              <span className={styles.helperText}>이미지 1장과 설명은 필수입니다.</span>
              <span className={styles.lengthText}>{content.length}/300자</span>
            </div>
          </section>

          <div className={styles.divider} />

          <section className={styles.keywordSection}>
            <div className={styles.keywordHeader}>
              <span className={styles.sectionTitle}>이 코디의 키워드를 선택해주세요</span>
            </div>

            <div className={styles.keywordMetaText}>최대 3개 까지만 선택해주세요</div>

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
            <div className={styles.sectionHeaderRow}>
              <h2 className={styles.sectionTitle}>착용 아이템</h2>

              <button
                type="button"
                className={styles.addItemButton}
                onClick={handleAddWearItem}
              >
                <span className={styles.addItemPlus}>+</span>
                <span className={styles.addItemText}>추가</span>
              </button>
            </div>

            <div className={styles.itemGrid}>
              {wearItems.map((item) => (
                <article key={item.id} className={styles.itemCard}>
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

          {visibleStatusMessage ? (
            <p className={styles.statusMessage}>{visibleStatusMessage}</p>
          ) : null}

          <div className={styles.submitArea}>
            <button
              type="button"
              className={styles.submitButton}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "처리 중..." : "작성 완료"}
            </button>
          </div>
        </section>
      </div>

      {blurDecisionOpen && uploadedImage && (
        <Modal onClose={() => setBlurDecisionOpen(false)}>
          {blurStep === "decision" && (
            <>
              <div className={styles.modalHeaderRow}>
                <h3 className={styles.modalTitle}>블러 확인</h3>

                <button
                  type="button"
                  className={styles.modalCloseButton}
                  onClick={() => setBlurDecisionOpen(false)}
                  aria-label="닫기"
                >
                  <X size={18} strokeWidth={2.4} />
                </button>
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
                <p className={styles.modalInfoText}>
                  가려짐이 충분하면 AI 블러를 그대로 사용하면 됩니다.
                </p>
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
                  수동블러처리
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