import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CreatePostResponse } from '@codinator/contracts';
import {
  fetcher,
  getAuthHeaders,
  resolveAssetUrl,
  uploadPostImage,
  type UploadedPostImageResponse,
} from '../../lib/api';

const Upload: React.FC = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedImage, setUploadedImage] = useState<UploadedPostImageResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('이미지를 먼저 업로드한 뒤 게시글 생성 API를 호출합니다.');

  const previewUrl = useMemo(() => {
    if (selectedFile) {
      return URL.createObjectURL(selectedFile);
    }

    return resolveAssetUrl(uploadedImage?.imageUrl);
  }, [selectedFile, uploadedImage]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadedImage(null);

    if (!file) {
      setMessage('업로드할 이미지를 선택해주세요.');
      return;
    }

    setMessage(`선택된 파일: ${file.name}`);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage('이미지 파일을 먼저 선택해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      setMessage('이미지 업로드 중...');
      const uploaded = await uploadPostImage(selectedFile);
      setUploadedImage(uploaded);
      setMessage('이미지 업로드 완료');
    } catch (err) {
      console.error('이미지 업로드 실패:', err);
      setMessage(err instanceof Error ? err.message : '이미지 업로드 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!uploadedImage) {
      setMessage('게시글 작성 전에 이미지 업로드를 먼저 완료해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      setMessage('게시글 생성 중...');

      await fetcher<CreatePostResponse>('/posts', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          content,
          image: {
            imageUrl: uploadedImage.imageUrl,
            storageKey: uploadedImage.storageKey ?? null,
            thumbnailUrl: uploadedImage.thumbnailUrl ?? null,
          },
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
        <p className="text-sm text-neutral-500">V1 기준 흐름: 이미지 업로드 → 업로드 결과로 게시글 생성</p>

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
          <span className="text-sm font-medium">이미지 파일</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleUpload}
            disabled={submitting || !selectedFile}
            className="rounded-2xl border border-neutral-900 px-4 py-3 text-neutral-900 disabled:opacity-60"
          >
            이미지 업로드
          </button>

          <button
            onClick={handleSubmit}
            disabled={submitting || !uploadedImage}
            className="rounded-2xl bg-neutral-900 px-4 py-3 text-white disabled:opacity-60"
          >
            {submitting ? '처리 중...' : '등록'}
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-neutral-50">
          {previewUrl ? (
            <img src={previewUrl} alt="미리보기" className="h-80 w-full object-cover" />
          ) : (
            <div className="flex h-80 items-center justify-center text-sm text-neutral-400">
              선택된 이미지가 없습니다.
            </div>
          )}
        </div>

        {uploadedImage ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-600">
            <div>imageUrl: {uploadedImage.imageUrl}</div>
            <div>storageKey: {uploadedImage.storageKey ?? '-'}</div>
          </div>
        ) : null}

        {message ? <p className="text-sm text-neutral-500">{message}</p> : null}
      </div>
    </div>
  );
};

export default Upload;
