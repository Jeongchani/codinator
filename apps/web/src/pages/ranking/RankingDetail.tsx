
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { GetRankingPostDetailResponse, RankingPeriod } from '@codinator/contracts';
import {
  clearAuthTokens,
  fetcher,
  getAuthHeaders,
  isAuthError,
} from '../../lib/api';
import {
  PostDetailBottomSheetContent,
  buildPostDetailSheetData,
} from '../../components/postdetail/PostDetailBottomSheet';

type Props = {
  postId?: number | null;
  period?: RankingPeriod;
  hideFeedLink?: boolean;
};

export default function RankingDetail({ postId, period, hideFeedLink = false }: Props) {
  const navigate = useNavigate();
  const { postId: routePostId } = useParams();
  const [searchParams] = useSearchParams();
  const [postData, setPostData] = useState<GetRankingPostDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const activePostId = postId ?? (routePostId ? Number(routePostId) : null);
  const periodParam = searchParams.get('period');
  const explicitPeriod: RankingPeriod | null =
    period ?? (periodParam === 'WEEKLY' || periodParam === 'MONTHLY' ? periodParam : null);

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      if (!activePostId) {
        setLoading(false);
        setPostData(null);
        return;
      }

      try {
        setLoading(true);
        const candidatePeriods: RankingPeriod[] = explicitPeriod ? [explicitPeriod] : ['WEEKLY', 'MONTHLY'];
        let matchedData: GetRankingPostDetailResponse | null = null;
        let lastMessage = '';

        for (const candidate of candidatePeriods) {
          try {
            const data = await fetcher<GetRankingPostDetailResponse>(`/rankings/posts/${activePostId}?period=${candidate}`, {
              headers: getAuthHeaders(),
            });
            matchedData = data;
            break;
          } catch (err) {
            const message = err instanceof Error ? err.message : '상세 데이터를 불러오지 못했습니다.';
            if (isAuthError(message)) {
              clearAuthTokens();
              navigate('/login');
              return;
            }
            lastMessage = message;
          }
        }

        if (cancelled) return;
        setPostData(matchedData);
        if (!matchedData && lastMessage) console.warn(lastMessage);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [activePostId, explicitPeriod, navigate]);



  const sheetData = useMemo(() => buildPostDetailSheetData(postData), [postData]);



  const handleGoToUserFeed = () => {
    const authorUserId = sheetData?.authorUserId;
    if (!authorUserId) {
      window.alert('유저 정보를 찾을 수 없습니다.');
      return;
    }
    navigate(`/user/${authorUserId}/feed`);
  };

  return (
    <PostDetailBottomSheetContent
      data={sheetData}
      loading={loading}
      hideFeedLink={hideFeedLink}
      onGoToUserFeed={handleGoToUserFeed}
    />
  );
}
