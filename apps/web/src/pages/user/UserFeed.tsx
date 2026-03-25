import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { GetFeedPostDetailResponse, GetUserFeedResponse } from '@codinator/contracts';
import {
  clearAuthTokens,
  fetcher,
  getAuthHeaders,
  resolveAssetUrl,
} from '../../lib/api';

function UserFeed() {
  const navigate = useNavigate();
  const { userId, postId } = useParams();
  const [feedData, setFeedData] = useState<GetUserFeedResponse | null>(null);
  const [postData, setPostData] = useState<GetFeedPostDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!userId) {
        setError('유저 정보가 없습니다.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        if (postId) {
          const detail = await fetcher<GetFeedPostDetailResponse>(`/users/${userId}/feed/${postId}`, {
            headers: getAuthHeaders(),
          });
          setPostData(detail);
          setFeedData(null);
        } else {
          const feed = await fetcher<GetUserFeedResponse>(`/users/${userId}/feed`, {
            headers: getAuthHeaders(),
          });
          setFeedData(feed);
          setPostData(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '피드를 불러오지 못했습니다.';
        setError(message);

        if (message.includes('Unauthorized') || message.includes('로그인이 필요합니다')) {
          clearAuthTokens();
          navigate('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [navigate, postId, userId]);

  if (loading) {
    return <div className="min-h-screen bg-white px-5 py-8 text-neutral-900">불러오는 중...</div>;
  }

  if (postData) {
    return (
      <div className="min-h-screen bg-white px-5 py-8 text-neutral-900">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <button className="w-fit rounded-full border px-4 py-2 text-sm" onClick={() => navigate(-1)}>
            뒤로가기
          </button>
          <h1 className="text-2xl font-bold">{postData.author.nickname}님의 피드 상세</h1>
          <img
            src={resolveAssetUrl(postData.image.imageUrl)}
            alt="피드 이미지"
            className="h-96 w-full rounded-3xl object-cover"
          />
          <div className="rounded-2xl border p-4">
            <p className="text-base font-semibold">{postData.content || '설명 없음'}</p>
            <p className="mt-2 text-sm text-neutral-500">좋아요 {postData.voteSummary.likeCount} · 싫어요 {postData.voteSummary.dislikeCount}</p>
            <p className="mt-2 text-sm text-neutral-500">
              랭킹 노출: {postData.rankingPeriods.length > 0 ? postData.rankingPeriods.join(', ') : '없음'}
            </p>
          </div>
          <div className="grid gap-2 rounded-2xl border p-4">
            <div className="font-semibold">착용 아이템</div>
            {postData.outfitItems.length > 0 ? (
              postData.outfitItems.map((item) => (
                <div key={item.id} className="text-sm text-neutral-600">
                  {item.category} · {item.brand || '-'} · {item.itemName || '-'}
                </div>
              ))
            ) : (
              <div className="text-sm text-neutral-500">등록된 아이템 없음</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-5 py-8 text-neutral-900">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <button className="w-fit rounded-full border px-4 py-2 text-sm" onClick={() => navigate(-1)}>
          뒤로가기
        </button>
        <h1 className="text-2xl font-bold">{feedData?.user.nickname ?? '유저'} 피드</h1>
        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        {feedData?.items.length ? (
          <div className="grid grid-cols-2 gap-3">
            {feedData.items.map((item) => (
              <button
                key={item.postId}
                className="overflow-hidden rounded-3xl border text-left"
                onClick={() => navigate(`/user/${userId}/feed/${item.postId}`)}
              >
                <img
                  src={resolveAssetUrl(item.thumbnailUrl)}
                  alt="피드 썸네일"
                  className="h-48 w-full object-cover"
                />
                <div className="p-3 text-xs text-neutral-500">
                  <div>{new Date(item.createdAt).toLocaleDateString('ko-KR')}</div>
                  <div className="mt-1">랭킹: {item.rankingPeriods.length > 0 ? item.rankingPeriods.join(', ') : '없음'}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">공개된 피드 게시글이 없습니다.</p>
        )}
      </div>
    </div>
  );
}

export default UserFeed;
