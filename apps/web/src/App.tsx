import { FormEvent, useEffect, useState } from 'react';
import type {
  HealthCheckResponse,
  SeedCheckRequest,
  SeedCheckResponse,
  SignupResponse,
  LoginResponse,
  LogoutResponse,
  GetMyFeedResponse,
  CreateFeedbackRequest,
  CreateFeedbackResponse
} from '@codinator/contracts';
import { fetcher } from './lib/api';

function App() {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [healthError, setHealthError] = useState('');
  const [email, setEmail] = useState('alice@codinator.com');
  const [password, setPassword] = useState('1234');

  const [result, setResult] = useState<SeedCheckResponse | null>(null);
  const [authResult, setAuthResult] = useState<
    SignupResponse | LoginResponse | LogoutResponse | GetMyFeedResponse | CreateFeedbackResponse | null
  >(null);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetcher<HealthCheckResponse>('/health')
      .then((data) => setHealth(data))
      .catch((err) => {
        setHealthError(err instanceof Error ? err.message : '헬스체크 실패');
      });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    const body: SeedCheckRequest = { email };

    try {
      const data = await fetcher<SeedCheckResponse>('/users/seed-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    try {
      const data = await fetcher<SignupResponse>('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      setAuthResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '회원가입 실패');
    }
  };

  const handleLogin = async () => {
    try {
      const data = await fetcher<LoginResponse>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      setAuthResult(data);
      localStorage.setItem('token', data.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 실패');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setAuthResult({ success: true, message: '로그아웃 완료 (토큰 삭제)' });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Codinator Smoke Test</h1>
          <p className="mt-2 text-slate-600">
            프론트 ↔ API ↔ Prisma ↔ Docker DB ↔ contracts 연결 확인용 임시 화면
          </p>
        </div>

        {/* 1. 헬스체크 */}
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">1. API 헬스체크</h2>

          {health && (
            <div className="space-y-1 text-sm">
              <p><strong>status:</strong> {health.status}</p>
              <p><strong>timestamp:</strong> {health.timestamp}</p>
            </div>
          )}

          {healthError && <p className="text-sm text-red-600">{healthError}</p>}
          {!health && !healthError && <p className="text-sm text-slate-500">확인 중...</p>}
        </section>

        {/* 2. Seed User 조회 */}
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">2. DB seed 유저 조회</h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="alice@codinator.com"
            />

            <button
              type="submit"
              disabled={loading}
              className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            >
              {loading ? '조회 중...' : '조회하기'}
            </button>
          </form>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          {result && (
            <div className="mt-4 rounded border bg-slate-50 p-4 text-sm">
              <p><strong>found:</strong> {String(result.found)}</p>

              {result.user ? (
                <ul className="mt-2 space-y-1">
                  <li><strong>id:</strong> {result.user.id}</li>
                  <li><strong>email:</strong> {result.user.email}</li>
                  <li><strong>createdAt:</strong> {result.user.createdAt}</li>
                </ul>
              ) : (
                <p className="mt-2">해당 유저 없음</p>
              )}
            </div>
          )}
        </section>

        {/* 3. Auth */}
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">3. Auth 테스트</h2>

          <div className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="비밀번호 입력"
            />

            <div className="flex space-x-2">
              <button onClick={handleSignup} className="rounded bg-green-600 px-4 py-2 text-white">
                회원가입
              </button>
              <button onClick={handleLogin} className="rounded bg-blue-600 px-4 py-2 text-white">
                로그인
              </button>
              <button onClick={handleLogout} className="rounded bg-red-600 px-4 py-2 text-white">
                로그아웃
              </button>
            </div>

            {authResult && (
              <div className="mt-4 rounded border bg-slate-50 p-4 text-sm overflow-auto">
                <pre>{JSON.stringify(authResult, null, 2)}</pre>
              </div>
            )}
          </div>
        </section>

        {/* 4. Feed 조회 */}
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">4. My Feed 조회</h2>

          <button
            onClick={async () => {
              try {
                const token = localStorage.getItem('token');
                const data = await fetcher<GetMyFeedResponse>('/feed/my', {
                  headers: { Authorization: `Bearer ${token}` },
                });
                setAuthResult(data);
              } catch (err) {
                setError(err instanceof Error ? err.message : '피드 조회 실패');
              }
            }}
            className="rounded bg-purple-600 px-4 py-2 text-white"
          >
            내 피드 조회
          </button>
        </section>

        {/* 5. Feedback 생성 */}
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">5. Feedback 생성</h2>

          <div className="space-y-3">
            <input
              type="number"
              placeholder="voteId 입력"
              className="w-full rounded border px-3 py-2"
              id="voteIdInput"
            />

            <input
              type="text"
              placeholder="tagCodes (예: POS_FIT_GOOD,NEG_COLOR_BAD)"
              className="w-full rounded border px-3 py-2"
              id="tagCodesInput"
            />

            <button
              onClick={async () => {
                try {
                  const voteId = Number(
                    (document.getElementById('voteIdInput') as HTMLInputElement).value
                  );
                  const tagCodes = (
                    document.getElementById('tagCodesInput') as HTMLInputElement
                  ).value
                    .split(',')
                    .map((s) => s.trim());

                  const body: CreateFeedbackRequest = { tagCodes };

                  const token = localStorage.getItem('token');
                  const data = await fetcher<CreateFeedbackResponse>(
                    `/feedback/${voteId}`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify(body),
                    }
                  );

                  setAuthResult(data);
                } catch (err) {
                  setError(err instanceof Error ? err.message : '피드백 생성 실패');
                }
              }}
              className="rounded bg-orange-600 px-4 py-2 text-white"
            >
              피드백 생성
            </button>
          </div>
        </section>

        {authResult && (
          <div className="mt-4 rounded border bg-slate-50 p-4 text-sm overflow-auto">
            <pre>{JSON.stringify(authResult, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
