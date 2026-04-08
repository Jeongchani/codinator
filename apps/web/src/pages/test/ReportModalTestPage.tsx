import { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import Reports from "../../components/Reports";
import {
  fetcher,
  getAuthHeaders,
  getPrimaryPostImageUrl,
} from "../../lib/api";
import type { GetRankingPostDetailResponse } from "@codinator/contracts";

export default function ReportModalTestPage() {
  const [postIdInput, setPostIdInput] = useState("12");
  const [activePostId, setActivePostId] = useState("12");
  const [period, setPeriod] = useState<"WEEKLY" | "MONTHLY">("WEEKLY");

  const [detail, setDetail] = useState<GetRankingPostDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [lastSubmitted, setLastSubmitted] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      if (!activePostId.trim()) {
        setDetail(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const data = await fetcher<GetRankingPostDetailResponse>(
          `/rankings/posts/${activePostId}?period=${period}`,
          {
            headers: getAuthHeaders(),
          }
        );

        if (cancelled) return;
        setDetail(data);
      } catch (err) {
        if (cancelled) return;

        const message =
          err instanceof Error
            ? err.message
            : "랭킹 상세 데이터를 불러오지 못했습니다.";

        setDetail(null);
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [activePostId, period]);

  const handleLoad = () => {
    if (!postIdInput.trim()) return;
    setActivePostId(postIdInput.trim());
  };

  return (
    <div className="min-h-screen bg-neutral-100 py-8">
      <div className="mx-auto w-[375px] max-w-[calc(100vw-24px)]">
        <div className="mb-4 rounded-[20px] bg-white p-4 shadow-lg">
          <h1 className="text-[22px] font-bold leading-8 text-black">
            RankingDetail 신고 테스트
          </h1>
          <p className="mt-1 text-sm leading-5 text-neutral-500">
            랭킹 상세 페이지에서 신고 버튼을 눌렀다고 가정한 테스트 페이지야.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-black">
                postId
              </label>
              <input
                value={postIdInput}
                onChange={(e) => setPostIdInput(e.target.value)}
                placeholder="ex) 12"
                className="h-11 w-full rounded-[12px] border border-neutral-300 px-3 text-sm outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-black">
                period
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPeriod("WEEKLY")}
                  className={`h-10 flex-1 rounded-[12px] border text-sm font-semibold ${
                    period === "WEEKLY"
                      ? "border-black bg-black text-white"
                      : "border-neutral-300 bg-white text-black"
                  }`}
                >
                  WEEKLY
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod("MONTHLY")}
                  className={`h-10 flex-1 rounded-[12px] border text-sm font-semibold ${
                    period === "MONTHLY"
                      ? "border-black bg-black text-white"
                      : "border-neutral-300 bg-white text-black"
                  }`}
                >
                  MONTHLY
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLoad}
              className="h-11 w-full rounded-[12px] bg-black text-sm font-semibold text-white"
            >
              랭킹 상세 다시 불러오기
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[24px] bg-white shadow-xl">
          <div className="relative h-[430px] bg-black">
            {detail && !loading && !error ? (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${getPrimaryPostImageUrl(detail)})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }}
              />
            ) : (
              <div className="absolute inset-0 bg-neutral-900" />
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/75" />

            <button
              type="button"
              onClick={() => setReportOpen(true)}
              disabled={!detail || loading}
              className={`absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md ${
                detail && !loading
                  ? "bg-black/45 text-white"
                  : "cursor-not-allowed bg-black/20 text-white/40"
              }`}
              aria-label="신고하기"
            >
              <Flag size={18} strokeWidth={2.2} />
            </button>

            <div className="absolute bottom-0 left-0 right-0 z-10 p-4 text-white">
              <div className="mb-2 text-sm font-medium uppercase tracking-wide text-white/70">
                {period === "MONTHLY" ? "this month" : "this week"}
              </div>

              {loading ? (
                <div className="text-sm text-white/80">불러오는 중...</div>
              ) : error ? (
                <div className="rounded-[12px] bg-black/35 p-3 text-sm text-red-200">
                  {error}
                </div>
              ) : detail ? (
                <>
                  <h2 className="text-[22px] font-semibold leading-7">
                    {detail.content}
                  </h2>
                  <p className="mt-2 text-sm text-white/80">
                    작성자: {detail.author.nickname}
                  </p>
                  <p className="mt-1 text-xs text-white/65">
                    신고 버튼을 누르면 기본은 게시글 탭으로 열리고, 안에서 사용자 탭으로 전환 가능
                  </p>
                </>
              ) : (
                <div className="text-sm text-white/80">
                  게시글을 찾을 수 없습니다.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 px-4 py-4 text-sm text-neutral-700">
            <div className="font-semibold text-black">현재 전달될 신고 대상</div>
            <div>
              게시글 탭 표시값:{" "}
              <span className="font-medium text-black">
                {detail?.content ?? "-"}
              </span>
            </div>
            <div>
              사용자 탭 표시값:{" "}
              <span className="font-medium text-black">
                {detail?.author.nickname ?? "-"}
              </span>
            </div>
            <div>
              게시글 ID / 사용자 ID:{" "}
              <span className="font-medium text-black">
                {detail ? `${detail.postId} / ${detail.author.userId}` : "-"}
              </span>
            </div>
          </div>
        </div>

        {lastSubmitted && (
          <div className="mt-4 rounded-[20px] bg-white p-4 shadow-lg">
            <div className="mb-2 text-sm font-semibold text-black">
              마지막 신고 응답
            </div>
            <pre className="max-h-[260px] overflow-auto rounded-[14px] border border-neutral-200 bg-neutral-50 p-4 text-xs leading-5 text-neutral-700">
              {lastSubmitted}
            </pre>
          </div>
        )}
      </div>

      {detail && (
        <Reports
          isOpen={reportOpen}
          onClose={() => setReportOpen(false)}
          defaultTab="post"
          postTarget={{
            id: detail.postId,
            displayText: detail.content,
          }}
          userTarget={{
            id: detail.author.userId,
            displayText: detail.author.nickname,
          }}
          onSubmitted={(response, payload) => {
            setLastSubmitted(
              JSON.stringify(
                {
                  payload,
                  response,
                },
                null,
                2
              )
            );
          }}
        />
      )}
    </div>
  );
}