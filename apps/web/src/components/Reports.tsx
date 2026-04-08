import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Siren, X } from "lucide-react";
import styles from "./Reports.module.css";

type ReportTab = "post" | "user";
type ReportReason = "SPAM" | "ABUSE" | "INAPPROPRIATE" | "ETC";

type ReportTarget = {
  id: number | string;
  label?: string;
  displayText?: string;
};

type ReportsProps = {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: ReportTab;
  postTarget?: ReportTarget | null;
  userTarget?: ReportTarget | null;
  onSubmitted?: (
    response: unknown,
    payload: {
      tab: ReportTab;
      targetId: number | string;
      reason: ReportReason;
      title: string;
      description?: string;
    }
  ) => void;
};

const BASE = "/api/v2";

const getAccessToken = () => localStorage.getItem("accessToken") ?? "";

const REASON_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: "SPAM", label: "스팸" },
  { value: "ABUSE", label: "욕설/비방" },
  { value: "INAPPROPRIATE", label: "부적절한 컨텐츠" },
  { value: "ETC", label: "기타" },
];

async function api<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAccessToken()}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!response.ok) {
    const raw = data as Record<string, unknown> | null;
    const message =
      raw && typeof raw === "object" && "message" in raw
        ? Array.isArray(raw.message)
          ? raw.message.join(", ")
          : String(raw.message)
        : text || "신고 처리 중 오류가 발생했습니다.";

    throw new Error(`[${response.status}] ${message}`);
  }

  return data as T;
}

function hasValidTarget(target?: ReportTarget | null) {
  if (!target) return false;
  return String(target.id).trim().length > 0;
}

function getPreferredTab(
  defaultTab: ReportTab,
  hasPost: boolean,
  hasUser: boolean
): ReportTab {
  if (defaultTab === "post" && hasPost) return "post";
  if (defaultTab === "user" && hasUser) return "user";
  if (hasPost) return "post";
  if (hasUser) return "user";
  return defaultTab;
}

export default function Reports({
  isOpen,
  onClose,
  defaultTab = "post",
  postTarget = null,
  userTarget = null,
  onSubmitted,
}: ReportsProps) {
  const hasPostTarget = hasValidTarget(postTarget);
  const hasUserTarget = hasValidTarget(userTarget);

  const [tab, setTab] = useState<ReportTab>(
    getPreferredTab(defaultTab, hasPostTarget, hasUserTarget)
  );
  const [reason, setReason] = useState<ReportReason>("ETC");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const nextTab = getPreferredTab(defaultTab, hasPostTarget, hasUserTarget);

    setTab(nextTab);
    setReason("ETC");
    setTitle("");
    setDescription("");
    setSubmitting(false);
    setFeedback(null);
  }, [isOpen, defaultTab, hasPostTarget, hasUserTarget]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);

      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [isOpen, onClose, submitting]);

  const activeTarget = useMemo(() => {
    return tab === "post" ? postTarget : userTarget;
  }, [tab, postTarget, userTarget]);

  const activeTargetDisplay = useMemo(() => {
    if (!activeTarget) return "신고 대상";

    const displayText =
      activeTarget.displayText?.trim() || activeTarget.label?.trim();

    if (displayText) return displayText;

    return tab === "post"
      ? `게시글 #${activeTarget.id}`
      : `사용자 #${activeTarget.id}`;
  }, [activeTarget, tab]);

  const submitDisabled =
    submitting ||
    !activeTarget ||
    !String(activeTarget.id).trim() ||
    !title.trim();

  const handleBackdropClick = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    if (event.target === event.currentTarget && !submitting) {
      onClose();
    }
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!activeTarget || !String(activeTarget.id).trim()) {
      setFeedback({
        type: "error",
        message: "신고 대상을 찾을 수 없습니다.",
      });
      return;
    }

    if (!title.trim()) {
      setFeedback({
        type: "error",
        message: "신고 제목을 입력해주세요.",
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const path =
        tab === "post"
          ? `/posts/${activeTarget.id}/reports`
          : `/users/${activeTarget.id}/reports`;

      const body: Record<string, unknown> = {
        title: title.trim(),
        reason,
      };

      if (description.trim()) {
        body.description = description.trim();
      }

      const response = await api("POST", path, body);

      setFeedback({
        type: "success",
        message: "신고가 정상적으로 접수되었습니다.",
      });

      onSubmitted?.(response, {
        tab,
        targetId: activeTarget.id,
        reason,
        title: title.trim(),
        description: description.trim() || undefined,
      });

      closeTimerRef.current = window.setTimeout(() => {
        onClose();
      }, 700);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "신고 처리 중 오류가 발생했습니다.";

      setFeedback({
        type: "error",
        message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div
        className={styles.card}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="신고 모달"
      >
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <span className={styles.titleIconWrap} aria-hidden="true">
              <Siren size={16} strokeWidth={2.2} className={styles.titleIcon} />
            </span>
            <h2 className={styles.title}>신고 하기</h2>
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="신고 모달 닫기"
          >
            <X size={22} strokeWidth={2.2} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.tabSwitch}>
            <div
              className={[
                styles.tabIndicator,
                tab === "user"
                  ? styles.tabIndicatorUser
                  : styles.tabIndicatorPost,
              ].join(" ")}
            />

            <button
              type="button"
              className={[
                styles.tabButton,
                tab === "post" ? styles.tabButtonActive : "",
                !hasPostTarget ? styles.tabButtonDisabled : "",
              ].join(" ")}
              onClick={() => hasPostTarget && setTab("post")}
              disabled={!hasPostTarget}
            >
              게시글
            </button>

            <button
              type="button"
              className={[
                styles.tabButton,
                tab === "user" ? styles.tabButtonActive : "",
                !hasUserTarget ? styles.tabButtonDisabled : "",
              ].join(" ")}
              onClick={() => hasUserTarget && setTab("user")}
              disabled={!hasUserTarget}
            >
              사용자
            </button>
          </div>

          <div className={styles.section}>
            <div className={styles.targetBox} title={activeTargetDisplay}>
              <span
                className={
                  activeTarget ? styles.targetText : styles.targetPlaceholder
                }
              >
                {activeTarget ? activeTargetDisplay : "신고 대상"}
              </span>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.fieldTitle}>신고 사유</div>

            <div className={styles.reasonGrid}>
              {REASON_OPTIONS.map((option) => {
                const active = reason === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={[
                      styles.reasonButton,
                      active ? styles.reasonButtonActive : "",
                    ].join(" ")}
                    onClick={() => setReason(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.labelRow}>
              <span className={styles.labelText}>신고 제목</span>
              <span className={styles.labelSubText}>(최대 100자)</span>
            </div>

            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
              placeholder="신고제목을입력해주세요."
              className={styles.textInput}
            />
          </div>

          <div className={styles.section}>
            <div className={styles.labelRow}>
              <span className={styles.labelText}>자세한 신고 사유</span>
              <span className={styles.labelSubText}>(선택, 최대 500자)</span>
            </div>

            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              placeholder="문제가 되는 내용을 자세히 적어주세요"
              className={styles.textarea}
            />
          </div>

          {feedback && (
            <div
              className={[
                styles.feedback,
                feedback.type === "success"
                  ? styles.feedbackSuccess
                  : styles.feedbackError,
              ].join(" ")}
            >
              {feedback.message}
            </div>
          )}

          <button
            type="button"
            className={[
              styles.submitButton,
              submitDisabled ? styles.submitButtonDisabled : "",
            ].join(" ")}
            onClick={handleSubmit}
            disabled={submitDisabled}
          >
            {submitting ? "신고 중..." : "신고 완료"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}