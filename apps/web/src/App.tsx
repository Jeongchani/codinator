import { useEffect, useState } from 'react';
import type {
  HealthCheckResponse,
  SignupResponse,
  LoginResponse,
  LogoutResponse,
  CreatePostResponse,
  GetEvaluationsResponse,
  CreateVoteResponse,
  GetRankingsResponse,
  GetMyFeedResponse,
} from '@codinator/contracts';
import { fetcher } from './lib/api';

/* ─── 공통 컴포넌트 ──────────────────────────────────── */

function Section({ title, num, children }: { title: string; num: number; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">
        {num}. {title}
      </h2>
      {children}
    </section>
  );
}

function ResultBox({ data, error }: { data: unknown; error: string }) {
  if (error) return <p className="mt-3 text-sm text-red-600">{error}</p>;
  if (!data) return null;
  return (
    <div className="mt-4 rounded border bg-slate-50 p-4 text-sm overflow-auto max-h-80">
      <pre className="whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

function Btn({
  children,
  onClick,
  color = 'blue',
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    green: 'bg-green-600 hover:bg-green-700',
    red: 'bg-red-600 hover:bg-red-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
    orange: 'bg-orange-600 hover:bg-orange-700',
    indigo: 'bg-indigo-600 hover:bg-indigo-700',
    teal: 'bg-teal-600 hover:bg-teal-700',
    pink: 'bg-pink-600 hover:bg-pink-700',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-4 py-2 text-sm text-white transition ${colors[color] ?? colors.blue} disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border px-3 py-2 text-sm"
      placeholder={placeholder}
    />
  );
}

/* ─── 헬퍼 함수 ───────────────────────────────────────── */

function authHeaders(token: string | null) {
  const h: Record<string, string> = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

function jsonHeaders(token: string | null) {
  return {
    'Content-Type': 'application/json',
    ...authHeaders(token),
  };
}

/* ─── App ──────────────────────────────────────────────── */

function App() {
  // ── 글로벌 상태
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [refreshToken, setRefreshToken] = useState<string | null>(localStorage.getItem('refreshToken'));

  // ── 1. Health
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [healthErr, setHealthErr] = useState('');

  // ── 2. Auth
  const [email, setEmail] = useState('alice@codinator.com');
  const [password, setPassword] = useState('1234');
  const [authData, setAuthData] = useState<unknown>(null);
  const [authErr, setAuthErr] = useState('');

  // ── 3. Posts
  const [postContent, setPostContent] = useState('프론트에서 올린 테스트 게시글');
  const [postImageUrl, setPostImageUrl] = useState('https://images.example.com/test.jpg');
  const [postData, setPostData] = useState<unknown>(null);
  const [postErr, setPostErr] = useState('');
  const [postDetailId, setPostDetailId] = useState('1');
  const [postDetailData, setPostDetailData] = useState<unknown>(null);
  const [postDetailErr, setPostDetailErr] = useState('');

  // ── 4. Evaluations
  const [evalData, setEvalData] = useState<unknown>(null);
  const [evalErr, setEvalErr] = useState('');
  const [evalDetailPostId, setEvalDetailPostId] = useState('1');
  const [evalDetailData, setEvalDetailData] = useState<unknown>(null);
  const [evalDetailErr, setEvalDetailErr] = useState('');

  // ── 5. Vote
  const [votePostId, setVotePostId] = useState('1');
  const [voteChoice, setVoteChoice] = useState<'LIKE' | 'DISLIKE'>('LIKE');
  const [voteData, setVoteData] = useState<unknown>(null);
  const [voteErr, setVoteErr] = useState('');

  // ── 6. Feedback
  const [fbVoteChoice, setFbVoteChoice] = useState<'LIKE' | 'DISLIKE'>('LIKE');
  const [tagsData, setTagsData] = useState<unknown>(null);
  const [tagsErr, setTagsErr] = useState('');
  const [fbVoteId, setFbVoteId] = useState('');
  const [fbTagId, setFbTagId] = useState('');
  const [fbData, setFbData] = useState<unknown>(null);
  const [fbErr, setFbErr] = useState('');

  // ── 7. Rankings
  const [rankPeriod, setRankPeriod] = useState<'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [rankData, setRankData] = useState<unknown>(null);
  const [rankErr, setRankErr] = useState('');
  const [rankDetailPostId, setRankDetailPostId] = useState('');
  const [rankDetailPeriod, setRankDetailPeriod] = useState<'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [rankDetailData, setRankDetailData] = useState<unknown>(null);
  const [rankDetailErr, setRankDetailErr] = useState('');

  // ── 8. Feeds
  const [myFeedData, setMyFeedData] = useState<unknown>(null);
  const [myFeedErr, setMyFeedErr] = useState('');
  const [userFeedId, setUserFeedId] = useState('2');
  const [userFeedData, setUserFeedData] = useState<unknown>(null);
  const [userFeedErr, setUserFeedErr] = useState('');

  // ── 헬스체크 자동 실행
  useEffect(() => {
    fetcher<HealthCheckResponse>('/health')
      .then(setHealth)
      .catch((e) => setHealthErr(e instanceof Error ? e.message : '헬스체크 실패'));
  }, []);

  // ── 토큰 저장
  const saveToken = (access: string, refresh: string) => {
    localStorage.setItem('token', access);
    localStorage.setItem('refreshToken', refresh);
    setToken(access);
    setRefreshToken(refresh);
  };

  const clearToken = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setRefreshToken(null);
  };

  /* ──────── API 호출 핸들러 ────────────────────────────── */

  const handleSignup = async () => {
    setAuthErr('');
    try {
      const data = await fetcher<SignupResponse>('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      setAuthData(data);
    } catch (e) {
      setAuthErr(e instanceof Error ? e.message : '회원가입 실패');
    }
  };

  const handleLogin = async () => {
    setAuthErr('');
    try {
      const data = await fetcher<LoginResponse>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      setAuthData(data);
      saveToken(data.accessToken, data.refreshToken);
    } catch (e) {
      setAuthErr(e instanceof Error ? e.message : '로그인 실패');
    }
  };

  const handleRefresh = async () => {
    setAuthErr('');
    try {
      const data = await fetcher<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      setAuthData(data);
      if (data.accessToken) {
        localStorage.setItem('token', data.accessToken);
        setToken(data.accessToken);
      }
    } catch (e) {
      setAuthErr(e instanceof Error ? e.message : '토큰 갱신 실패');
    }
  };

  const handleLogout = async () => {
    setAuthErr('');
    try {
      const data = await fetcher<LogoutResponse>('/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      setAuthData(data);
      clearToken();
    } catch (e) {
      setAuthErr(e instanceof Error ? e.message : '로그아웃 실패');
    }
  };

  const handleCreatePost = async () => {
    setPostErr('');
    try {
      const data = await fetcher<CreatePostResponse>('/posts', {
        method: 'POST',
        headers: jsonHeaders(token),
        body: JSON.stringify({
          content: postContent,
          image: { imageUrl: postImageUrl },
          outfitItems: [
            { category: 'TOP', itemName: '테스트 상의', brand: 'TEST' },
            { category: 'BOTTOM', itemName: '테스트 하의', brand: 'TEST' },
          ],
        }),
      });
      setPostData(data);
    } catch (e) {
      setPostErr(e instanceof Error ? e.message : '게시글 생성 실패');
    }
  };

  const handleGetPostDetail = async () => {
    setPostDetailErr('');
    try {
      const data = await fetcher(`/posts/${postDetailId}`, {
        headers: authHeaders(token),
      });
      setPostDetailData(data);
    } catch (e) {
      setPostDetailErr(e instanceof Error ? e.message : '게시글 조회 실패');
    }
  };

  const handleGetEvaluations = async () => {
    setEvalErr('');
    try {
      const data = await fetcher<GetEvaluationsResponse>('/evaluations', {
        headers: authHeaders(token),
      });
      setEvalData(data);
    } catch (e) {
      setEvalErr(e instanceof Error ? e.message : '평가 목록 조회 실패');
    }
  };

  const handleGetEvalDetail = async () => {
    setEvalDetailErr('');
    try {
      const data = await fetcher(`/posts/${evalDetailPostId}/evaluation`, {
        headers: authHeaders(token),
      });
      setEvalDetailData(data);
    } catch (e) {
      setEvalDetailErr(e instanceof Error ? e.message : '평가 상세 조회 실패');
    }
  };

  const handleVote = async () => {
    setVoteErr('');
    try {
      const data = await fetcher<CreateVoteResponse>(`/posts/${votePostId}/votes`, {
        method: 'POST',
        headers: jsonHeaders(token),
        body: JSON.stringify({ choice: voteChoice }),
      });
      setVoteData(data);
    } catch (e) {
      setVoteErr(e instanceof Error ? e.message : '투표 실패');
    }
  };

  const handleGetTags = async () => {
    setTagsErr('');
    try {
      const data = await fetcher(`/feedback/tags?voteChoice=${fbVoteChoice}`, {
        headers: authHeaders(token),
      });
      setTagsData(data);
    } catch (e) {
      setTagsErr(e instanceof Error ? e.message : '태그 조회 실패');
    }
  };

  const handleCreateFeedback = async () => {
    setFbErr('');
    try {
      const data = await fetcher(`/feedback/${fbVoteId}`, {
        method: 'POST',
        headers: jsonHeaders(token),
        body: JSON.stringify({ tagId: Number(fbTagId) }),
      });
      setFbData(data);
    } catch (e) {
      setFbErr(e instanceof Error ? e.message : '피드백 생성 실패');
    }
  };

  const handleGetRankings = async () => {
    setRankErr('');
    try {
      const data = await fetcher<GetRankingsResponse>(`/rankings?period=${rankPeriod}`, {
        headers: authHeaders(token),
      });
      setRankData(data);
    } catch (e) {
      setRankErr(e instanceof Error ? e.message : '랭킹 조회 실패');
    }
  };

  const handleGetRankDetail = async () => {
    setRankDetailErr('');
    try {
      const data = await fetcher(
        `/posts/${rankDetailPostId}/ranking?period=${rankDetailPeriod}`,
        { headers: authHeaders(token) },
      );
      setRankDetailData(data);
    } catch (e) {
      setRankDetailErr(e instanceof Error ? e.message : '랭킹 상세 조회 실패');
    }
  };

  const handleGetMyFeed = async () => {
    setMyFeedErr('');
    try {
      const data = await fetcher<GetMyFeedResponse>('/feed/my', {
        headers: authHeaders(token),
      });
      setMyFeedData(data);
    } catch (e) {
      setMyFeedErr(e instanceof Error ? e.message : '내 피드 조회 실패');
    }
  };

  const handleGetUserFeed = async () => {
    setUserFeedErr('');
    try {
      const data = await fetcher(`/feed/user/${userFeedId}`, {
        headers: authHeaders(token),
      });
      setUserFeedData(data);
    } catch (e) {
      setUserFeedErr(e instanceof Error ? e.message : '유저 피드 조회 실패');
    }
  };

  /* ──────── 렌더링 ─────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* 헤더 */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Codinator API 테스트</h1>
          <p className="mt-1 text-sm text-slate-500">
            프론트엔드에서 모든 백엔드 API를 순차적으로 테스트할 수 있는 페이지입니다.
          </p>
          {token ? (
            <p className="mt-2 rounded bg-green-50 px-3 py-1 text-sm text-green-700">
              로그인 상태 (토큰: {token.slice(0, 20)}...)
            </p>
          ) : (
            <p className="mt-2 rounded bg-yellow-50 px-3 py-1 text-sm text-yellow-700">
              비로그인 상태 — 2번에서 로그인해 주세요
            </p>
          )}
        </div>

        {/* 1. 헬스체크 */}
        <Section num={1} title="API 헬스체크">
          {health && (
            <div className="space-y-1 text-sm">
              <p><strong>status:</strong> {health.status}</p>
              <p><strong>timestamp:</strong> {health.timestamp}</p>
            </div>
          )}
          {healthErr && <p className="text-sm text-red-600">{healthErr}</p>}
          {!health && !healthErr && <p className="text-sm text-slate-500">확인 중...</p>}
        </Section>

        {/* 2. Auth */}
        <Section num={2} title="인증 (회원가입 / 로그인 / 토큰갱신 / 로그아웃)">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input value={email} onChange={setEmail} placeholder="이메일" type="email" />
              <Input value={password} onChange={setPassword} placeholder="비밀번호" type="password" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn onClick={handleSignup} color="green">회원가입</Btn>
              <Btn onClick={handleLogin} color="blue">로그인</Btn>
              <Btn onClick={handleRefresh} color="indigo">토큰 갱신</Btn>
              <Btn onClick={handleLogout} color="red">로그아웃</Btn>
            </div>
          </div>
          <ResultBox data={authData} error={authErr} />
        </Section>

        {/* 3. 게시글 */}
        <Section num={3} title="게시글 (생성 / 상세 조회)">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">게시글 생성</p>
              <Input value={postContent} onChange={setPostContent} placeholder="게시글 내용" />
              <Input value={postImageUrl} onChange={setPostImageUrl} placeholder="이미지 URL" />
              <Btn onClick={handleCreatePost} color="green">게시글 생성</Btn>
              <ResultBox data={postData} error={postErr} />
            </div>

            <hr />

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">게시글 상세 조회</p>
              <div className="flex gap-2">
                <Input value={postDetailId} onChange={setPostDetailId} placeholder="postId" type="number" />
                <Btn onClick={handleGetPostDetail} color="blue">조회</Btn>
              </div>
              <ResultBox data={postDetailData} error={postDetailErr} />
            </div>
          </div>
        </Section>

        {/* 4. 평가 */}
        <Section num={4} title="평가존 (목록 / 상세)">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">평가 목록 (OPEN 상태)</p>
              <Btn onClick={handleGetEvaluations} color="purple">평가 목록 조회</Btn>
              <ResultBox data={evalData} error={evalErr} />
            </div>

            <hr />

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">평가 게시글 상세</p>
              <div className="flex gap-2">
                <Input value={evalDetailPostId} onChange={setEvalDetailPostId} placeholder="postId" type="number" />
                <Btn onClick={handleGetEvalDetail} color="purple">상세 조회</Btn>
              </div>
              <ResultBox data={evalDetailData} error={evalDetailErr} />
            </div>
          </div>
        </Section>

        {/* 5. 투표 */}
        <Section num={5} title="투표">
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={votePostId} onChange={setVotePostId} placeholder="postId" type="number" />
              <select
                value={voteChoice}
                onChange={(e) => setVoteChoice(e.target.value as 'LIKE' | 'DISLIKE')}
                className="rounded border px-3 py-2 text-sm"
              >
                <option value="LIKE">LIKE (좋다)</option>
                <option value="DISLIKE">DISLIKE (싫어함)</option>
              </select>
            </div>
            <Btn onClick={handleVote} color="orange">투표하기</Btn>
          </div>
          <ResultBox data={voteData} error={voteErr} />
        </Section>

        {/* 6. 피드백 */}
        <Section num={6} title="피드백 (태그 조회 / 태그 선택)">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">피드백 태그 목록 조회</p>
              <div className="flex gap-2">
                <select
                  value={fbVoteChoice}
                  onChange={(e) => setFbVoteChoice(e.target.value as 'LIKE' | 'DISLIKE')}
                  className="rounded border px-3 py-2 text-sm"
                >
                  <option value="LIKE">LIKE용 태그</option>
                  <option value="DISLIKE">DISLIKE용 태그</option>
                </select>
                <Btn onClick={handleGetTags} color="teal">태그 조회</Btn>
              </div>
              <ResultBox data={tagsData} error={tagsErr} />
            </div>

            <hr />

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">피드백 생성 (태그 선택)</p>
              <div className="grid grid-cols-2 gap-2">
                <Input value={fbVoteId} onChange={setFbVoteId} placeholder="voteId (투표 응답에서 확인)" type="number" />
                <Input value={fbTagId} onChange={setFbTagId} placeholder="tagId (태그 조회에서 확인)" type="number" />
              </div>
              <Btn onClick={handleCreateFeedback} color="teal">피드백 생성</Btn>
              <ResultBox data={fbData} error={fbErr} />
            </div>
          </div>
        </Section>

        {/* 7. 랭킹 */}
        <Section num={7} title="랭킹 (목록 / 상세)">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">랭킹 목록</p>
              <div className="flex gap-2">
                <select
                  value={rankPeriod}
                  onChange={(e) => setRankPeriod(e.target.value as 'WEEKLY' | 'MONTHLY')}
                  className="rounded border px-3 py-2 text-sm"
                >
                  <option value="WEEKLY">주간</option>
                  <option value="MONTHLY">월간</option>
                </select>
                <Btn onClick={handleGetRankings} color="pink">랭킹 조회</Btn>
              </div>
              <ResultBox data={rankData} error={rankErr} />
            </div>

            <hr />

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">랭킹 게시글 상세</p>
              <div className="flex gap-2">
                <Input value={rankDetailPostId} onChange={setRankDetailPostId} placeholder="postId" type="number" />
                <select
                  value={rankDetailPeriod}
                  onChange={(e) => setRankDetailPeriod(e.target.value as 'WEEKLY' | 'MONTHLY')}
                  className="rounded border px-3 py-2 text-sm"
                >
                  <option value="WEEKLY">주간</option>
                  <option value="MONTHLY">월간</option>
                </select>
                <Btn onClick={handleGetRankDetail} color="pink">상세 조회</Btn>
              </div>
              <ResultBox data={rankDetailData} error={rankDetailErr} />
            </div>
          </div>
        </Section>

        {/* 8. 피드 */}
        <Section num={8} title="피드 (내 피드 / 상대방 피드)">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">내 피드</p>
              <Btn onClick={handleGetMyFeed} color="indigo">내 피드 조회</Btn>
              <ResultBox data={myFeedData} error={myFeedErr} />
            </div>

            <hr />

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">상대방 피드 (랭킹존에서 유저 클릭 시)</p>
              <div className="flex gap-2">
                <Input value={userFeedId} onChange={setUserFeedId} placeholder="userId" type="number" />
                <Btn onClick={handleGetUserFeed} color="indigo">유저 피드 조회</Btn>
              </div>
              <ResultBox data={userFeedData} error={userFeedErr} />
            </div>
          </div>
        </Section>

        {/* 푸터 */}
        <div className="pb-8 text-center text-xs text-slate-400">
          Codinator v1 API Test Page — Seed 계정: alice / bob / charlie / diana (비번: 1234)
        </div>
      </div>
    </div>
  );
}

export default App;
