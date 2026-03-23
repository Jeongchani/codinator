import { useEffect, useState } from 'react';
import type {
  HealthCheckResponse,
  SignupResponse,
  LoginResponse,
  LogoutResponse,
} from '@codinator/contracts';
import { fetcher } from './lib/api';

/* ------------------------------------------------------------------ */
/*  공통 유틸                                                          */
/* ------------------------------------------------------------------ */
const getToken = () => localStorage.getItem('token') ?? '';

const authHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
});

/** JSON 결과를 보기 좋게 렌더링 */
function JsonBlock({ data }: { data: unknown }) {
  if (data === null || data === undefined) return null;
  return (
    <pre className="mt-3 max-h-80 overflow-auto rounded border bg-slate-50 p-3 text-xs leading-relaxed">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

/** 섹션 래퍼 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  메인 App                                                           */
/* ------------------------------------------------------------------ */
function App() {
  /* ---- 공통 상태 ---- */
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [healthError, setHealthError] = useState('');

  /* ---- Auth ---- */
  const [email, setEmail] = useState('alice@codinator.com');
  const [nickname, setNickname] = useState('앨리스');
  const [password, setPassword] = useState('1234');
  const [authResult, setAuthResult] = useState<
    SignupResponse | LoginResponse | LogoutResponse | null
  >(null);
  const [authError, setAuthError] = useState('');

  /* ---- Posts ---- */
  const [postResult, setPostResult] = useState<unknown>(null);
  const [postError, setPostError] = useState('');
  const [postContent, setPostContent] = useState('봄 코디 평가 부탁드립니다.');
  const [postImageUrl, setPostImageUrl] = useState(
    'https://images.example.com/posts/new-post.jpg',
  );
  const [myPostId, setMyPostId] = useState('');

  /* ---- Evaluations ---- */
  const [evalResult, setEvalResult] = useState<unknown>(null);
  const [evalError, setEvalError] = useState('');
  const [evalPostId, setEvalPostId] = useState('');

  /* ---- Votes ---- */
  const [voteResult, setVoteResult] = useState<unknown>(null);
  const [voteError, setVoteError] = useState('');
  const [votePostId, setVotePostId] = useState('');
  const [voteChoice, setVoteChoice] = useState<'LIKE' | 'DISLIKE'>('LIKE');
  const [feedbackVoteId, setFeedbackVoteId] = useState('');
  const [feedbackTagId, setFeedbackTagId] = useState('');
  const [tagChoice, setTagChoice] = useState<'LIKE' | 'DISLIKE'>('LIKE');

  /* ---- Rankings ---- */
  const [rankResult, setRankResult] = useState<unknown>(null);
  const [rankError, setRankError] = useState('');
  const [rankPeriod, setRankPeriod] = useState<'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [rankPostId, setRankPostId] = useState('');

  /* ---- Feeds ---- */
  const [feedResult, setFeedResult] = useState<unknown>(null);
  const [feedError, setFeedError] = useState('');
  const [feedPostId, setFeedPostId] = useState('');
  const [feedUserId, setFeedUserId] = useState('');

  /* ================================================================ */
  /*  1. Health Check                                                  */
  /* ================================================================ */
  useEffect(() => {
    fetcher<HealthCheckResponse>('/health')
      .then(setHealth)
      .catch((err) => setHealthError(err instanceof Error ? err.message : '헬스체크 실패'));
  }, []);

  /* ================================================================ */
  /*  2. Auth                                                          */
  /* ================================================================ */
  const handleSignup = async () => {
    setAuthError('');
    try {
      const data = await fetcher<SignupResponse>('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nickname, password }),
      });
      setAuthResult(data);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '회원가입 실패');
    }
  };

  const handleLogin = async () => {
    setAuthError('');
    try {
      const data = await fetcher<LoginResponse>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      setAuthResult(data);
      localStorage.setItem('token', data.accessToken);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '로그인 실패');
    }
  };

  const handleRefresh = async () => {
    setAuthError('');
    try {
      const data = await fetcher<unknown>('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: (authResult as LoginResponse)?.refreshToken ?? '',
        }),
      });
      setAuthResult(data as LoginResponse);
      if ((data as LoginResponse).accessToken) {
        localStorage.setItem('token', (data as LoginResponse).accessToken);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '토큰 갱신 실패');
    }
  };

  const handleLogout = async () => {
    setAuthError('');
    try {
      const refreshToken = (authResult as LoginResponse)?.refreshToken;
      if (refreshToken) {
        await fetcher<LogoutResponse>('/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      }
      localStorage.removeItem('token');
      setAuthResult({ success: true, message: '로그아웃 완료' });
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '로그아웃 실패');
    }
  };

  /* ================================================================ */
  /*  3. Posts                                                         */
  /* ================================================================ */
  const handleCreatePost = async () => {
    setPostError('');
    try {
      const data = await fetcher('/posts', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          content: postContent,
          image: { imageUrl: postImageUrl },
          outfitItems: [{ category: 'TOP', itemName: '화이트 셔츠', brand: 'SPAO' }],
        }),
      });
      setPostResult(data);
    } catch (err) {
      setPostError(err instanceof Error ? err.message : '게시글 작성 실패');
    }
  };

  const handleGetMyPost = async () => {
    setPostError('');
    try {
      const data = await fetcher(`/posts/me/${myPostId}`, { headers: authHeaders() });
      setPostResult(data);
    } catch (err) {
      setPostError(err instanceof Error ? err.message : '내 게시글 조회 실패');
    }
  };

  /* ================================================================ */
  /*  4. Evaluations                                                   */
  /* ================================================================ */
  const handleGetEvaluations = async () => {
    setEvalError('');
    try {
      const data = await fetcher('/evaluations', { headers: authHeaders() });
      setEvalResult(data);
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : '평가 목록 조회 실패');
    }
  };

  const handleGetEvalPostDetail = async () => {
    setEvalError('');
    try {
      const data = await fetcher(`/evaluations/posts/${evalPostId}`, {
        headers: authHeaders(),
      });
      setEvalResult(data);
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : '평가 게시글 상세 조회 실패');
    }
  };

  /* ================================================================ */
  /*  5. Votes & Feedback                                              */
  /* ================================================================ */
  const handleGetTags = async () => {
    setVoteError('');
    try {
      const data = await fetcher(`/evaluations/tags?voteChoice=${tagChoice}`, {
        headers: authHeaders(),
      });
      setVoteResult(data);
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : '태그 조회 실패');
    }
  };

  const handleCreateVote = async () => {
    setVoteError('');
    try {
      const data = await fetcher(`/evaluations/posts/${votePostId}/votes`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ choice: voteChoice }),
      });
      setVoteResult(data);
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : '투표 실패');
    }
  };

  const handleCreateFeedback = async () => {
    setVoteError('');
    try {
      const data = await fetcher(`/evaluations/votes/${feedbackVoteId}/feedback`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ tagId: Number(feedbackTagId) }),
      });
      setVoteResult(data);
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : '피드백 실패');
    }
  };

  /* ================================================================ */
  /*  6. Rankings                                                      */
  /* ================================================================ */
  const handleGetRankings = async () => {
    setRankError('');
    try {
      const data = await fetcher(`/rankings?period=${rankPeriod}`, {
        headers: authHeaders(),
      });
      setRankResult(data);
    } catch (err) {
      setRankError(err instanceof Error ? err.message : '랭킹 조회 실패');
    }
  };

  const handleGetRankPostDetail = async () => {
    setRankError('');
    try {
      const data = await fetcher(`/rankings/posts/${rankPostId}?period=${rankPeriod}`, {
        headers: authHeaders(),
      });
      setRankResult(data);
    } catch (err) {
      setRankError(err instanceof Error ? err.message : '랭킹 게시글 상세 조회 실패');
    }
  };

  /* ================================================================ */
  /*  7. Feeds                                                         */
  /* ================================================================ */
  const handleGetMyFeed = async () => {
    setFeedError('');
    try {
      const data = await fetcher('/users/me/feed', { headers: authHeaders() });
      setFeedResult(data);
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : '내 피드 조회 실패');
    }
  };

  const handleGetMyFeedPost = async () => {
    setFeedError('');
    try {
      const data = await fetcher(`/users/me/feed/${feedPostId}`, { headers: authHeaders() });
      setFeedResult(data);
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : '내 피드 상세 조회 실패');
    }
  };

  const handleGetUserFeed = async () => {
    setFeedError('');
    try {
      const data = await fetcher(`/users/${feedUserId}/feed`, { headers: authHeaders() });
      setFeedResult(data);
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : '유저 피드 조회 실패');
    }
  };

  const handleGetUserFeedPost = async () => {
    setFeedError('');
    try {
      const data = await fetcher(`/users/${feedUserId}/feed/${feedPostId}`, {
        headers: authHeaders(),
      });
      setFeedResult(data);
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : '유저 피드 상세 조회 실패');
    }
  };

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */
  const inputCls = 'w-full rounded border px-3 py-2 text-sm';
  const btnBase = 'rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50';

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Codinator API Tester</h1>
          <p className="mt-1 text-sm text-slate-500">
            프론트(5173) → Vite Proxy → API(3000) 전체 엔드포인트 테스트
          </p>
          {getToken() && (
            <p className="mt-1 text-xs text-green-600">
              토큰 저장됨: {getToken().slice(0, 20)}...
            </p>
          )}
        </div>

        {/* 1. Health */}
        <Section title="1. 헬스체크  GET /health">
          {health && (
            <p className="text-sm">
              <strong>status:</strong> {health.status} &nbsp;|&nbsp;
              <strong>timestamp:</strong> {health.timestamp}
            </p>
          )}
          {healthError && <p className="text-sm text-red-600">{healthError}</p>}
          {!health && !healthError && <p className="text-sm text-slate-400">확인 중...</p>}
        </Section>

        {/* 2. Auth */}
        <Section title="2. Auth  (회원가입 / 로그인 / 갱신 / 로그아웃)">
          <div className="space-y-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="이메일"
            />
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className={inputCls}
              placeholder="닉네임 (회원가입용)"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              placeholder="비밀번호"
            />
            <div className="flex flex-wrap gap-2">
              <button onClick={handleSignup} className={`${btnBase} bg-green-600`}>
                회원가입
              </button>
              <button onClick={handleLogin} className={`${btnBase} bg-blue-600`}>
                로그인
              </button>
              <button onClick={handleRefresh} className={`${btnBase} bg-yellow-600`}>
                토큰 갱신
              </button>
              <button onClick={handleLogout} className={`${btnBase} bg-red-600`}>
                로그아웃
              </button>
            </div>
          </div>
          {authError && <p className="mt-2 text-sm text-red-600">{authError}</p>}
          <JsonBlock data={authResult} />
        </Section>

        {/* 3. Posts */}
        <Section title="3. Posts  (게시글 작성 / 내 게시글 조회)">
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">게시글 작성</p>
            <input
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              className={inputCls}
              placeholder="게시글 본문"
            />
            <input
              value={postImageUrl}
              onChange={(e) => setPostImageUrl(e.target.value)}
              className={inputCls}
              placeholder="이미지 URL"
            />
            <button onClick={handleCreatePost} className={`${btnBase} bg-indigo-600`}>
              POST /posts  (게시글 작성)
            </button>

            <hr className="my-3" />

            <p className="text-xs font-medium text-slate-500">내 게시글 상세</p>
            <div className="flex gap-2">
              <input
                value={myPostId}
                onChange={(e) => setMyPostId(e.target.value)}
                className={inputCls}
                placeholder="postId"
              />
              <button onClick={handleGetMyPost} className={`${btnBase} bg-indigo-600`}>
                GET /posts/me/:postId
              </button>
            </div>
          </div>
          {postError && <p className="mt-2 text-sm text-red-600">{postError}</p>}
          <JsonBlock data={postResult} />
        </Section>

        {/* 4. Evaluations */}
        <Section title="4. Evaluations  (평가존 목록 / 평가 게시글 상세)">
          <div className="space-y-2">
            <button onClick={handleGetEvaluations} className={`${btnBase} bg-purple-600`}>
              GET /evaluations  (평가존 목록)
            </button>

            <hr className="my-3" />

            <p className="text-xs font-medium text-slate-500">평가 게시글 상세</p>
            <div className="flex gap-2">
              <input
                value={evalPostId}
                onChange={(e) => setEvalPostId(e.target.value)}
                className={inputCls}
                placeholder="postId"
              />
              <button onClick={handleGetEvalPostDetail} className={`${btnBase} bg-purple-600`}>
                GET /evaluations/posts/:postId
              </button>
            </div>
          </div>
          {evalError && <p className="mt-2 text-sm text-red-600">{evalError}</p>}
          <JsonBlock data={evalResult} />
        </Section>

        {/* 5. Votes & Feedback */}
        <Section title="5. Votes & Feedback  (태그 조회 / 투표 / 피드백)">
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">피드백 태그 조회</p>
            <div className="flex gap-2">
              <select
                value={tagChoice}
                onChange={(e) => setTagChoice(e.target.value as 'LIKE' | 'DISLIKE')}
                className={inputCls}
              >
                <option value="LIKE">LIKE</option>
                <option value="DISLIKE">DISLIKE</option>
              </select>
              <button onClick={handleGetTags} className={`${btnBase} bg-teal-600`}>
                GET /evaluations/tags
              </button>
            </div>

            <hr className="my-3" />

            <p className="text-xs font-medium text-slate-500">투표하기</p>
            <div className="flex gap-2">
              <input
                value={votePostId}
                onChange={(e) => setVotePostId(e.target.value)}
                className={inputCls}
                placeholder="postId"
              />
              <select
                value={voteChoice}
                onChange={(e) => setVoteChoice(e.target.value as 'LIKE' | 'DISLIKE')}
                className={inputCls}
              >
                <option value="LIKE">LIKE</option>
                <option value="DISLIKE">DISLIKE</option>
              </select>
              <button onClick={handleCreateVote} className={`${btnBase} bg-teal-600`}>
                POST 투표
              </button>
            </div>

            <hr className="my-3" />

            <p className="text-xs font-medium text-slate-500">피드백 태그 선택</p>
            <div className="flex gap-2">
              <input
                value={feedbackVoteId}
                onChange={(e) => setFeedbackVoteId(e.target.value)}
                className={inputCls}
                placeholder="voteId"
              />
              <input
                value={feedbackTagId}
                onChange={(e) => setFeedbackTagId(e.target.value)}
                className={inputCls}
                placeholder="tagId"
              />
              <button onClick={handleCreateFeedback} className={`${btnBase} bg-teal-600`}>
                POST 피드백
              </button>
            </div>
          </div>
          {voteError && <p className="mt-2 text-sm text-red-600">{voteError}</p>}
          <JsonBlock data={voteResult} />
        </Section>

        {/* 6. Rankings */}
        <Section title="6. Rankings  (랭킹 목록 / 랭킹 게시글 상세)">
          <div className="space-y-2">
            <div className="flex gap-2">
              <select
                value={rankPeriod}
                onChange={(e) => setRankPeriod(e.target.value as 'WEEKLY' | 'MONTHLY')}
                className={inputCls}
              >
                <option value="WEEKLY">WEEKLY</option>
                <option value="MONTHLY">MONTHLY</option>
              </select>
              <button onClick={handleGetRankings} className={`${btnBase} bg-orange-600`}>
                GET /rankings
              </button>
            </div>

            <hr className="my-3" />

            <p className="text-xs font-medium text-slate-500">랭킹 게시글 상세</p>
            <div className="flex gap-2">
              <input
                value={rankPostId}
                onChange={(e) => setRankPostId(e.target.value)}
                className={inputCls}
                placeholder="postId"
              />
              <button onClick={handleGetRankPostDetail} className={`${btnBase} bg-orange-600`}>
                GET /rankings/posts/:postId
              </button>
            </div>
          </div>
          {rankError && <p className="mt-2 text-sm text-red-600">{rankError}</p>}
          <JsonBlock data={rankResult} />
        </Section>

        {/* 7. Feeds */}
        <Section title="7. Feeds  (내 피드 / 타 유저 피드)">
          <div className="space-y-2">
            <button onClick={handleGetMyFeed} className={`${btnBase} bg-pink-600`}>
              GET /users/me/feed  (내 피드)
            </button>

            <hr className="my-3" />

            <p className="text-xs font-medium text-slate-500">피드 게시글 상세</p>
            <div className="flex gap-2">
              <input
                value={feedPostId}
                onChange={(e) => setFeedPostId(e.target.value)}
                className={inputCls}
                placeholder="postId"
              />
              <button onClick={handleGetMyFeedPost} className={`${btnBase} bg-pink-600`}>
                GET /users/me/feed/:postId
              </button>
            </div>

            <hr className="my-3" />

            <p className="text-xs font-medium text-slate-500">다른 유저 피드</p>
            <div className="flex gap-2">
              <input
                value={feedUserId}
                onChange={(e) => setFeedUserId(e.target.value)}
                className={inputCls}
                placeholder="userId"
              />
              <button onClick={handleGetUserFeed} className={`${btnBase} bg-pink-600`}>
                GET /users/:userId/feed
              </button>
            </div>

            <div className="flex gap-2">
              <input
                value={feedUserId}
                onChange={(e) => setFeedUserId(e.target.value)}
                className={inputCls}
                placeholder="userId"
              />
              <input
                value={feedPostId}
                onChange={(e) => setFeedPostId(e.target.value)}
                className={inputCls}
                placeholder="postId"
              />
              <button onClick={handleGetUserFeedPost} className={`${btnBase} bg-pink-600`}>
                GET /users/:userId/feed/:postId
              </button>
            </div>
          </div>
          {feedError && <p className="mt-2 text-sm text-red-600">{feedError}</p>}
          <JsonBlock data={feedResult} />
        </Section>
      </div>
    </div>
  );
}

export default App;
