import { FormEvent, useEffect, useState } from 'react';
import { FeedbackTagCode } from '@codinator/contracts';
import { fetcher } from './lib/api';

type HealthResponse = {
  status: string;
  service: string;
  timestamp: string;
};

type SeedCheckResponse = {
  found: boolean;
  user: {
    id: number;
    email: string;
    gender: 'M' | 'F';
    birthDate: string;
    phoneNumber: string;
    createdAt: string;
  } | null;
};

function App() {
  const [healthStatus, setHealthStatus] = useState('로딩 중...');
  const [email, setEmail] = useState('test1@codinator.com');
  const [result, setResult] = useState<SeedCheckResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const exampleTag: FeedbackTagCode = 'POS_FIT_GOOD';

  useEffect(() => {
    fetcher<HealthResponse>('/health')
      .then((data) => {
        setHealthStatus(`백엔드 상태: ${data.status} / 서비스: ${data.service}`);
      })
      .catch(() => {
        setHealthStatus('백엔드 연결 실패');
      });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await fetcher<SeedCheckResponse>('/users/seed-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
      <h1 className="text-4xl font-bold text-blue-600 mb-4">Codinator Web</h1>
      <p className="text-lg mb-8">프론트 ↔ 백엔드 ↔ DB seed 왕복 테스트</p>

      <div className="p-6 bg-white rounded-xl shadow-md space-y-6 w-full max-w-xl">
        <div className="p-4 bg-gray-100 rounded border border-gray-200">
          <h2 className="font-semibold mb-2">API 기본 상태</h2>
          <p className={healthStatus.includes('실패') ? 'text-red-500' : 'text-green-600 font-medium'}>
            {healthStatus}
          </p>
        </div>

        <div className="p-4 bg-gray-100 rounded border border-gray-200">
          <h2 className="font-semibold mb-2">공용 패키지 타입 테스트</h2>
          <p>
            FeedbackTagCode 예시:
            <span className="ml-2 font-mono bg-gray-200 px-2 py-1 rounded">{exampleTag}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-4 bg-gray-100 rounded border border-gray-200 space-y-3">
          <h2 className="font-semibold">Seed 유저 조회 테스트</h2>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="test1@codinator.com"
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? '조회 중...' : '조회하기'}
          </button>

          {error && <p className="text-red-500">{error}</p>}

          {result && (
            <div className="mt-4 p-4 bg-white rounded border">
              <p className="font-medium">조회 결과: {result.found ? '성공' : '없음'}</p>

              {result.user && (
                <ul className="mt-2 text-sm space-y-1">
                  <li><strong>ID:</strong> {result.user.id}</li>
                  <li><strong>Email:</strong> {result.user.email}</li>
                  <li><strong>Gender:</strong> {result.user.gender}</li>
                  <li><strong>BirthDate:</strong> {result.user.birthDate}</li>
                  <li><strong>Phone:</strong> {result.user.phoneNumber}</li>
                  <li><strong>CreatedAt:</strong> {result.user.createdAt}</li>
                </ul>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default App;