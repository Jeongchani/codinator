import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

function UserFeed() {
  const navigate = useNavigate();
  const { userId } = useParams();

  return (
    <div className="min-h-screen bg-white px-5 py-8 text-neutral-900">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <button className="w-fit rounded-full border px-4 py-2 text-sm" onClick={() => navigate(-1)}>
          뒤로가기
        </button>
        <h1 className="text-2xl font-bold">유저 피드</h1>
        <p className="text-sm text-neutral-500">선택한 유저 ID: {userId}</p>
        <p className="text-sm text-neutral-500">
          이 파일은 비어 있어서 라우트 연결 시 바로 깨질 상태였다. 일단 임시 화면으로 복구했다.
        </p>
      </div>
    </div>
  );
}

export default UserFeed;
