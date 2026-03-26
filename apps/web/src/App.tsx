import { useEffect, useState } from 'react';
import type {
  Gender,
  HealthCheckResponse,
  LoginResponse,
  LogoutResponse,
  SignupResponse,
} from '@codinator/contracts';
import { fetcher } from './lib/api';

function App() {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [healthError, setHealthError] = useState('');
  const [email, setEmail] = useState('alice@codinator.com');
  const [nickname, setNickname] = useState('앨리스테스트');
  const [password, setPassword] = useState('1234');
  const [birthDate, setBirthDate] = useState('2000-01-01');
  const [gender, setGender] = useState<Gender>('FEMALE');
  const [phoneNumber, setPhoneNumber] = useState('010-1234-5678');
  const [authResult, setAuthResult] = useState<SignupResponse | LoginResponse | LogoutResponse | null>(
    null,
  );
  const [error, setError] = useState('');

  useEffect(() => {
    fetcher<HealthCheckResponse>('/health')
      .then((data) => {
        setHealth(data);
      })
      .catch((err) => {
        setHealthError(err instanceof Error ? err.message : '헬스체크 실패');
      });
  }, []);

  const handleSignup = async () => {
    setError('');

    try {
      const data = await fetcher<SignupResponse>('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nickname, password, birthDate, gender, phoneNumber }),
      });
      setAuthResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '회원가입 실패');
    }
  };

  const handleLogin = async () => {
    setError('');

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
          <p className="mt-2 text-slate-600">프론트 ↔ API ↔ Prisma ↔ DB 연결 확인용 임시 화면</p>
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
          <h2 className="mb-3 text-lg font-semibold">2. Auth 테스트</h2>
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="이메일 입력"
            />
            <input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="닉네임 입력"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="비밀번호 입력"
            />
            <input
              type="date"
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
              className="w-full rounded border px-3 py-2"
            />
            <select
              value={gender}
              onChange={(event) => setGender(event.target.value as Gender)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="MALE">MALE</option>
              <option value="FEMALE">FEMALE</option>
            </select>
            <input
              type="text"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="전화번호 입력"
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

            {error && <p className="text-sm text-red-600">{error}</p>}

            {authResult && (
              <div className="mt-4 overflow-auto rounded border bg-slate-50 p-4 text-sm">
                <pre>{JSON.stringify(authResult, null, 2)}</pre>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
