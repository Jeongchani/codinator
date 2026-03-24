import React from 'react';
import { useNavigate } from 'react-router-dom';

const Evaluation: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white px-5 py-8 text-neutral-900">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <button className="w-fit rounded-full border px-4 py-2 text-sm" onClick={() => navigate(-1)}>
          뒤로가기
        </button>
        <h1 className="text-2xl font-bold">평가 존</h1>
        <p className="text-sm text-neutral-500">
          현재 이 페이지는 라우트 연결용 임시 화면이다. 실제 평가 목록 API를 붙일 때
          <code> /evaluations</code> 응답을 여기로 연결하면 된다.
        </p>
        <button
          className="rounded-2xl bg-neutral-900 px-4 py-3 text-white"
          onClick={() => navigate('/vote/feedback')}
        >
          피드백 화면 열기
        </button>
      </div>
    </div>
  );
};

export default Evaluation;
