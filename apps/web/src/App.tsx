import { useEffect, useState } from 'react';
import { FeedbackTag } from '@codinator/contracts'; // 💡 공용 패키지 임포트!
import { fetcher } from './lib/api';

  function App() {
  const [healthStatus, setHealthStatus] = useState<string>('로딩 중...');
  // 타입 추론 테스트용 변수
  const exampleTag: FeedbackTag = FeedbackTag.COLOR_GOOD;

  useEffect(() => {
    // 백엔드 API 호출 테스트
    fetcher('/health')
      .then((data) => setHealthStatus(`백엔드 상태: ${data.status} (태그: ${data.testSharedTag})`))
      .catch(() => setHealthStatus('백엔드 연결 실패!'));
  }, []);
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold text-blue-600 mb-4">Codinator Web</h1>
      <p className="text-lg mb-8">패션 피드백 플랫폼 프론트엔드 초기화 성공!</p>
      
      <div className="p-6 bg-white rounded-xl shadow-md space-y-4 w-full max-w-md">
        <div className="p-4 bg-gray-100 rounded border border-gray-200">
          <h2 className="font-semibold mb-2">🔌 API 통신 테스트</h2>
          <p className={healthStatus.includes('실패') ? 'text-red-500' : 'text-green-600 font-medium'}>
            {healthStatus}
          </p>
        </div>

        <div className="p-4 bg-gray-100 rounded border border-gray-200">
          <h2 className="font-semibold mb-2">📦 공용 패키지(Contracts) 테스트</h2>
          <p>임포트된 태그 값: <span className="font-mono bg-gray-200 px-1 rounded">{exampleTag}</span></p>
        </div>
      </div>
    </div>
  );
}

export default App;