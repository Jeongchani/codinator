import { FormEvent, useEffect, useState } from 'react';
import type {
  HealthCheckResponse,
  SeedCheckRequest,
  SeedCheckResponse,
  SignupResponse,
  LoginResponse,
  LogoutResponse
} from '@codinator/contracts';
import { fetcher } from './lib/api';


function Test() {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [healthError, setHealthError] = useState('');
  const [email, setEmail] = useState('alice@codinator.com');
  const [password, setPassword] = useState('1234'); // Auth용 비밀번호 상태 추가
  
  const [result, setResult] = useState<SeedCheckResponse | null>(null);
  const [authResult, setAuthResult] = useState<SignupResponse | LoginResponse | LogoutResponse | null>(null); // Auth 결과 상태 추가
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetcher<HealthCheckResponse>('/health')
      .then((data) => {
        setHealth(data);
      })
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청 실패');
    } finally {
      setLoading(false);
    }
  };

  // 회원가입
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

  // 로그인
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

  // 로그아웃 (프론트에서 토큰 삭제)
  const handleLogout = () => {
    localStorage.removeItem('token');
    setAuthResult({ message: '로그아웃 완료 (토큰 삭제)' });
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

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">1. API 헬스체크</h2>

          {health && (
            <div className="space-y-1 text-sm">
              <p>
                <strong>status:</strong> {health.status}
              </p>
              <p>
                <strong>timestamp:</strong> {health.timestamp}
              </p>
            </div>
          )}

          {healthError && <p className="text-sm text-red-600">{healthError}</p>}

          {!health && !healthError && <p className="text-sm text-slate-500">확인 중...</p>}
        </section>

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
              <p>
                <strong>found:</strong> {String(result.found)}
              </p>

              {result.user ? (
                <ul className="mt-2 space-y-1">
                  <li>
                    <strong>id:</strong> {result.user.id}
                  </li>
                  <li>
                    <strong>email:</strong> {result.user.email}
                  </li>
                  <li>
                    <strong>createdAt:</strong> {result.user.createdAt}
                  </li>
                </ul>
              ) : (
                <p className="mt-2">해당 유저 없음</p>
              )}
            </div>
          )}
        </section>

        {/* Auth 테스트 섹션 추가 */}
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">3. Auth 테스트 (회원가입/로그인/로그아웃)</h2>
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

      </div>
    </div>
  );
}

export default Test;