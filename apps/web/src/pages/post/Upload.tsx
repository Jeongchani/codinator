import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetcher, getAuthHeaders } from '../../lib/api';

const Upload: React.FC = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('/uploads/look1.jpg');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('이미지 업로드 기능 연결 전까지는 imageUrl 문자열로 테스트합니다.');

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setMessage('');

      await fetcher('/posts', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          content,
          image: { imageUrl },
          outfitItems: [],
        }),
      });

      setMessage('게시글 생성 요청 완료');
      navigate('/rankingZone');
    } catch (err) {
      console.error('게시글 작성 실패:', err);
      setMessage(err instanceof Error ? err.message : '게시글 작성 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white px-5 py-8 text-neutral-900">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <button className="w-fit rounded-full border px-4 py-2 text-sm" onClick={() => navigate(-1)}>
          뒤로가기
        </button>
        <h1 className="text-2xl font-bold">게시글 작성</h1>
        <p className="text-sm text-neutral-500">
          실험용 이미지는 <code>apps/web/public/uploads</code> 아래에 두고
          <code> /uploads/파일명.jpg</code> 형식으로 입력하면 된다.
        </p>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">설명</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[120px] rounded-xl border px-4 py-3"
            placeholder="코디 설명을 입력하세요"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">이미지 경로</span>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="rounded-xl border px-4 py-3"
            placeholder="/uploads/look1.jpg"
          />
        </label>

        <div className="overflow-hidden rounded-2xl border bg-neutral-50">
          <img src={imageUrl} alt="미리보기" className="h-80 w-full object-cover" />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-2xl bg-neutral-900 px-4 py-3 text-white disabled:opacity-60"
        >
          {submitting ? '등록 중...' : '등록'}
        </button>

        {message ? <p className="text-sm text-neutral-500">{message}</p> : null}
      </div>
    </div>
  );
};

export default Upload;
