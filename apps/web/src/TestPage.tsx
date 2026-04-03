/**
 * C:dinator V2 API 통합 테스트 페이지
 * 사용법: App.tsx에 <Route path="/test" element={<TestPage />} /> 추가 후 /test 접속
 */

import { useState, useRef } from 'react';

// ─── API 헬퍼 ─────────────────────────────────────────────────────────────────

const BASE = '/api/v2';
const tok = () => localStorage.getItem('accessToken') ?? '';

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let d: unknown;
  try { d = JSON.parse(text); } catch { d = text; }
  if (!res.ok) {
    const raw = d as Record<string, unknown> | null;
    const msg = raw && typeof raw === 'object' && 'message' in raw
      ? (Array.isArray(raw.message) ? (raw.message as string[]).join(', ') : String(raw.message))
      : text;
    throw new Error(`[${res.status}] ${msg}`);
  }
  return d as T;
}

async function apiForm<T>(method: string, path: string, fd: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${tok()}` },
    body: fd,
  });
  const text = await res.text();
  let d: unknown;
  try { d = JSON.parse(text); } catch { d = text; }
  if (!res.ok) {
    const raw = d as Record<string, unknown> | null;
    const msg = raw && typeof raw === 'object' && 'message' in raw ? String(raw.message) : text;
    throw new Error(`[${res.status}] ${msg}`);
  }
  return d as T;
}

const fmt = (v: unknown) => JSON.stringify(v, null, 2);

function run<T>(fn: () => Promise<T>, set: (s: string) => void) {
  fn().then(d => set(fmt(d))).catch((e: Error) => set(`[Error] ${e.message}`));
}

// ─── 공통 UI ─────────────────────────────────────────────────────────────────

const C = {
  card: {
    border: '1px solid #e2e8f0', borderRadius: 8, padding: 16,
    marginBottom: 14, background: '#fff',
  } as React.CSSProperties,
  label: {
    fontSize: 11, color: '#718096', display: 'block', marginBottom: 4,
    fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em',
  } as React.CSSProperties,
  input: {
    width: '100%', padding: '7px 10px', border: '1px solid #cbd5e0',
    borderRadius: 6, fontSize: 13, boxSizing: 'border-box' as const, outline: 'none',
  } as React.CSSProperties,
  btn: (color = '#4299e1'): React.CSSProperties => ({
    padding: '7px 14px', background: color, color: '#fff', border: 'none',
    borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    marginRight: 6, marginTop: 4,
  }),
  tab: (active: boolean, color = '#4299e1'): React.CSSProperties => ({
    padding: '7px 14px', background: active ? color : '#edf2f7',
    color: active ? '#fff' : '#4a5568', border: 'none', borderRadius: 6,
    fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', marginRight: 6,
  }),
  h3: { fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#1a202c' } as React.CSSProperties,
  info: (color: 'blue' | 'yellow' | 'green' | 'red' = 'blue'): React.CSSProperties => {
    const map = {
      blue:   { bg: '#ebf8ff', border: '#bee3f8', text: '#2b6cb0' },
      yellow: { bg: '#fffbeb', border: '#f6e05e', text: '#7c4a03' },
      green:  { bg: '#f0fff4', border: '#9ae6b4', text: '#276749' },
      red:    { bg: '#fff5f5', border: '#feb2b2', text: '#c53030' },
    }[color];
    return { padding: '8px 10px', background: map.bg, border: `1px solid ${map.border}`, color: map.text, borderRadius: 6, fontSize: 11, marginBottom: 10 };
  },
};

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <span style={C.label}>{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} style={C.input} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <span style={C.label}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...C.input, width: 220 }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Result({ data }: { data: string }) {
  if (!data) return null;
  const err = data.startsWith('[Error]');
  return (
    <pre style={{
      marginTop: 8, padding: 10, borderRadius: 6, fontSize: 11,
      overflow: 'auto', maxHeight: 260,
      background: err ? '#fff5f5' : '#f0fff4',
      border: `1px solid ${err ? '#fc8181' : '#68d391'}`,
      color: err ? '#c53030' : '#276749',
    }}>{data}</pre>
  );
}

// ─── SECTION 1: 로그인 ────────────────────────────────────────────────────────

function S_Login() {
  const [email, setEmail] = useState('admin@codinator.com');
  const [pw, setPw] = useState('1234');
  const [res, setRes] = useState('');

  return (
    <div style={C.card}>
      <h3 style={C.h3}>🔐 로그인</h3>
      <div style={C.info('blue')}>
        기본값: <strong>admin@codinator.com / 1234</strong> (관리자) — 일반 유저로 테스트하려면 이메일/비밀번호 변경
      </div>
      <Field label="이메일" value={email} onChange={setEmail} placeholder="user@codinator.com" />
      <Field label="비밀번호" value={pw} onChange={setPw} type="password" />
      <button style={C.btn('#2b6cb0')} onClick={() => run(async () => {
        const d = await api<{ accessToken: string; refreshToken?: string; user: { id: number; nickname: string } }>(
          'POST', '/auth/login', { email, password: pw }
        );
        localStorage.setItem('accessToken', d.accessToken);
        if (d.refreshToken) localStorage.setItem('refreshToken', d.refreshToken);
        localStorage.setItem('userId', String(d.user.id));
        localStorage.setItem('nickname', d.user.nickname);
        return { '✅ 로그인 성공': true, userId: d.user.id, nickname: d.user.nickname };
      }, setRes)}>POST /auth/login</button>
      <button style={C.btn('#718096')} onClick={() => {
        localStorage.clear(); setRes(fmt({ message: '로그아웃 완료 (로컬 토큰 삭제)' }));
      }}>로그아웃 (토큰 삭제)</button>
      {tok() && (
        <div style={{ ...C.info('green'), marginTop: 8 }}>
          ✅ 현재 토큰 보유 — userId: <strong>{localStorage.getItem('userId')}</strong> / 닉네임: <strong>{localStorage.getItem('nickname')}</strong>
        </div>
      )}
      <Result data={res} />
    </div>
  );
}

// ─── SECTION 2: 마이페이지 ────────────────────────────────────────────────────

function S_MyPage() {
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [res, setRes] = useState('');

  return (
    <>
      <div style={C.card}>
        <h3 style={C.h3}>👤 내 프로필 조회</h3>
        <button style={C.btn('#38a169')} onClick={() => run(() => api('GET', '/users/me'), setRes)}>
          GET /users/me
        </button>
        <Result data={res} />
      </div>

      <div style={C.card}>
        <h3 style={C.h3}>✏️ 프로필 수정 (닉네임 / 전화번호)</h3>
        <div style={C.info('blue')}>빈 칸으로 두면 해당 필드는 변경하지 않습니다.</div>
        <Field label="새 닉네임 (선택)" value={nickname} onChange={setNickname} placeholder="변경할 닉네임" />
        <Field label="전화번호 (선택)" value={phone} onChange={setPhone} placeholder="010-1234-5678" />
        <button style={C.btn('#ed8936')} onClick={() => {
          const body: Record<string, string> = {};
          if (nickname.trim()) body.nickname = nickname.trim();
          if (phone.trim()) body.phone = phone.trim();
          if (!Object.keys(body).length) { setRes('[Error] 닉네임 또는 전화번호를 입력하세요'); return; }
          run(() => api('PATCH', '/users/me', body), setRes);
        }}>PATCH /users/me</button>
        <Result data={res} />
      </div>

      <div style={C.card}>
        <h3 style={C.h3}>🔒 비밀번호 변경</h3>
        <Field label="현재 비밀번호" value={curPw} onChange={setCurPw} type="password" />
        <Field label="새 비밀번호" value={newPw} onChange={setNewPw} type="password" />
        <button style={C.btn('#e53e3e')} onClick={() =>
          run(() => api('PATCH', '/users/me/password', { currentPassword: curPw, newPassword: newPw }), setRes)
        }>PATCH /users/me/password</button>
        <Result data={res} />
      </div>
    </>
  );
}

// ─── SECTION 3: 관리자 ────────────────────────────────────────────────────────

function S_Admin() {
  const [tab, setTab] = useState<'postList' | 'userList' | 'handlePost' | 'handleUser'>('postList');
  const [status, setStatus] = useState('PENDING');
  const [reportId, setReportId] = useState('');
  const [action, setAction] = useState('RESOLVED');
  const [postId, setPostId] = useState('');
  const [postStatus, setPostStatus] = useState('HIDDEN');
  const [hiddenReason, setHiddenReason] = useState('');
  const [res, setRes] = useState('');

  const tabs = [
    { key: 'postList' as const,  label: '📋 게시글 신고 목록' },
    { key: 'userList' as const,  label: '👥 사용자 신고 목록' },
    { key: 'handlePost' as const, label: '✅ 게시글 신고 처리' },
    { key: 'handleUser' as const, label: '✅ 사용자 신고 처리' },
  ];

  return (
    <>
      <div style={C.info('yellow')}>
        ⚠️ 관리자(ADMIN) 계정으로 로그인 후 사용하세요. 일반 계정은 403 Forbidden이 반환됩니다.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setRes(''); }}
            style={C.tab(tab === t.key, '#553c9a')}>{t.label}</button>
        ))}
      </div>

      {(tab === 'postList' || tab === 'userList') && (
        <div style={C.card}>
          <h3 style={C.h3}>{tab === 'postList' ? '📋 게시글 신고 목록' : '👥 사용자 신고 목록'}</h3>
          <SelectField label="상태 필터" value={status} onChange={setStatus} options={[
            { value: '', label: '전체' },
            { value: 'PENDING', label: 'PENDING (미처리)' },
            { value: 'RESOLVED', label: 'RESOLVED (처리 완료)' },
            { value: 'REJECTED', label: 'REJECTED (반려)' },
          ]} />
          <button style={C.btn('#553c9a')} onClick={() => {
            const qs = status ? `?status=${status}` : '';
            const path = tab === 'postList' ? `/admin/post-reports${qs}` : `/admin/user-reports${qs}`;
            run(() => api('GET', path), setRes);
          }}>조회</button>
          <Result data={res} />
        </div>
      )}

      {tab === 'handlePost' && (
        <div style={C.card}>
          <h3 style={C.h3}>✅ 게시글 신고 처리</h3>
          <div style={C.info('blue')}>신고 목록에서 reportId를 확인한 후 입력하세요.</div>
          <Field label="신고 ID (reportId)" value={reportId} onChange={setReportId} placeholder="ex) 3" />
          <SelectField label="처리 결과" value={action} onChange={setAction} options={[
            { value: 'RESOLVED', label: 'RESOLVED — 신고 처리 완료' },
            { value: 'REJECTED', label: 'REJECTED — 신고 반려' },
          ]} />
          <button style={C.btn('#e53e3e')} onClick={() =>
            run(() => api('PATCH', `/admin/post-reports/${reportId}`, { action }), setRes)
          }>PATCH /admin/post-reports/:reportId</button>
          <Result data={res} />
        </div>
      )}

      {tab === 'handleUser' && (
        <div style={C.card}>
          <h3 style={C.h3}>✅ 사용자 신고 처리</h3>
          <Field label="신고 ID (reportId)" value={reportId} onChange={setReportId} placeholder="ex) 5" />
          <SelectField label="처리 결과" value={action} onChange={setAction} options={[
            { value: 'RESOLVED', label: 'RESOLVED — 신고 처리 완료' },
            { value: 'REJECTED', label: 'REJECTED — 신고 반려' },
          ]} />
          <button style={C.btn('#e53e3e')} onClick={() =>
            run(() => api('PATCH', `/admin/user-reports/${reportId}`, { action }), setRes)
          }>PATCH /admin/user-reports/:reportId</button>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#4a5568' }}>🚫 게시글 상태 강제 변경 (ADMIN)</h4>
            <Field label="게시글 ID (postId)" value={postId} onChange={setPostId} placeholder="ex) 12" />
            <SelectField label="변경할 상태" value={postStatus} onChange={setPostStatus} options={[
              { value: 'ACTIVE', label: 'ACTIVE — 숨김 해제' },
              { value: 'HIDDEN', label: 'HIDDEN — 숨김' },
              { value: 'DELETED', label: 'DELETED — 삭제' },
            ]} />
            {postStatus === 'HIDDEN' && (
              <Field label="숨김 사유 (선택, 최대 255자)" value={hiddenReason} onChange={setHiddenReason}
                placeholder="커뮤니티 가이드라인 위반" />
            )}
            <button style={C.btn('#553c9a')} onClick={() => {
              const body: Record<string, unknown> = { status: postStatus };
              if (postStatus === 'HIDDEN' && hiddenReason.trim()) body.hiddenReason = hiddenReason.trim();
              run(() => api('PATCH', `/admin/posts/${postId}/status`, body), setRes);
            }}>PATCH /admin/posts/:postId/status</button>
          </div>
          <Result data={res} />
        </div>
      )}
    </>
  );
}

// ─── SECTION 4: 북마크 ────────────────────────────────────────────────────────

function S_Bookmarks() {
  const [postId, setPostId] = useState('');
  const [res, setRes] = useState('');

  return (
    <>
      <div style={C.card}>
        <h3 style={C.h3}>🔖 내 북마크 목록</h3>
        <button style={C.btn('#38a169')} onClick={() => run(() => api('GET', '/users/me/bookmarks'), setRes)}>
          GET /users/me/bookmarks
        </button>
        <Result data={res} />
      </div>
      <div style={C.card}>
        <h3 style={C.h3}>➕ 북마크 추가</h3>
        <div style={C.info('blue')}>OPEN / ENDED / CLOSED 상태 게시글 모두 북마크 가능합니다.</div>
        <Field label="게시글 ID (postId)" value={postId} onChange={setPostId} placeholder="ex) 12" />
        <button style={C.btn('#ed8936')} onClick={() => run(() => api('POST', `/posts/${postId}/bookmarks`), setRes)}>
          POST /posts/:postId/bookmarks
        </button>
        <Result data={res} />
      </div>
      <div style={C.card}>
        <h3 style={C.h3}>🗑️ 북마크 삭제</h3>
        <Field label="게시글 ID (postId)" value={postId} onChange={setPostId} placeholder="ex) 12" />
        <button style={C.btn('#e53e3e')} onClick={() => run(() => api('DELETE', `/posts/${postId}/bookmarks`), setRes)}>
          DELETE /posts/:postId/bookmarks
        </button>
        <Result data={res} />
      </div>
    </>
  );
}

// ─── SECTION 5: 내 피드 ───────────────────────────────────────────────────────

function S_MyFeed() {
  const [tab, setTab] = useState<'list' | 'detail' | 'edit'>('list');
  const [allItems, setAllItems] = useState<Record<string, unknown>[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'ENDED' | 'HIDDEN'>('ALL');
  const [postId, setPostId] = useState('');
  const [content, setContent] = useState('');
  const [outfitRaw, setOutfitRaw] = useState('');
  const [res, setRes] = useState('');

  type FeedItem = { postId: number; postStatus: string; content?: string; evaluation?: { status: string } };

  const filtered = (allItems as unknown as FeedItem[]).filter(item => {
    if (filter === 'ALL')    return true;
    if (filter === 'OPEN')   return item.evaluation?.status === 'OPEN';
    if (filter === 'ENDED')  return item.evaluation?.status === 'ENDED';
    if (filter === 'HIDDEN') return item.postStatus === 'HIDDEN';
    return true;
  });

  const tabs = [
    { key: 'list'   as const, label: '📋 피드 목록' },
    { key: 'detail' as const, label: '🔍 게시글 상세' },
    { key: 'edit'   as const, label: '✏️ 게시글 수정' },
  ];

  return (
    <>
      <div style={C.info('green')}>
        💡 <strong>게시글 수정 위치 제안:</strong> 실제 서비스에서는 <code>MyFeedDetail</code> 페이지 내부에 "수정" 버튼을 배치하는 것이 자연스럽습니다. 상세 페이지에서 게시글 상태(OPEN/ENDED)를 확인하고, OPEN이면 outfitItems만, ENDED/CLOSED이면 content도 수정 가능하도록 조건부로 렌더링하세요.
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setRes(''); }}
            style={C.tab(tab === t.key, '#2b6cb0')}>{t.label}</button>
        ))}
      </div>

      {tab === 'list' && (
        <div style={C.card}>
          <h3 style={C.h3}>📋 내 피드 목록 (상태 필터)</h3>
          <div style={C.info('blue')}>
            서버에서 전체 목록을 가져온 뒤 클라이언트에서 필터합니다. OPEN=평가중, ENDED=평가완료, HIDDEN=숨김 처리됨.
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {(['ALL', 'OPEN', 'ENDED', 'HIDDEN'] as const).map(f => {
              const colorMap = { ALL: '#4a5568', OPEN: '#38a169', ENDED: '#2b6cb0', HIDDEN: '#e53e3e' };
              const active = filter === f;
              return (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '6px 14px', borderRadius: 20, border: `2px solid ${colorMap[f]}`,
                  background: active ? colorMap[f] : '#fff', color: active ? '#fff' : colorMap[f],
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>{f}</button>
              );
            })}
          </div>
          <button style={C.btn('#38a169')} onClick={() => {
            api<{ items: Record<string, unknown>[] }>('GET', '/users/me/feed')
              .then(d => { setAllItems(d.items); setRes(fmt(d)); })
              .catch((e: Error) => setRes(`[Error] ${e.message}`));
          }}>GET /users/me/feed</button>

          {allItems.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: '#718096', marginBottom: 6 }}>
                전체 {allItems.length}건 → <strong>{filter}</strong> 필터 결과: {filtered.length}건
              </div>
              {filtered.map(item => (
                <div key={item.postId} style={{
                  padding: '8px 12px', background: '#f7fafc', borderRadius: 6, marginBottom: 4,
                  fontSize: 12, border: '1px solid #e2e8f0', display: 'flex', gap: 10, alignItems: 'center',
                }}>
                  <span><strong>#{item.postId}</strong></span>
                  <span style={{ color: item.postStatus === 'HIDDEN' ? '#e53e3e' : '#2d3748' }}>
                    {item.postStatus}
                  </span>
                  <span style={{ color: '#38a169' }}>{item.evaluation?.status ?? '—'}</span>
                  <span style={{ color: '#718096', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {String(item.content ?? '').slice(0, 40)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Result data={res} />
        </div>
      )}

      {tab === 'detail' && (
        <div style={C.card}>
          <h3 style={C.h3}>🔍 내 피드 게시글 상세 (소유자 전용)</h3>
          <div style={C.info('green')}>
            소유자는 OPEN / ENDED / CLOSED / HIDDEN 상태 게시글 모두 조회 가능. 랭킹 조건 없음.
          </div>
          <Field label="postId" value={postId} onChange={setPostId} placeholder="조회할 게시글 ID" />
          <button style={C.btn('#2b6cb0')} onClick={() => run(() => api('GET', `/users/me/feed/${postId}`), setRes)}>
            GET /users/me/feed/:postId
          </button>
          <Result data={res} />
        </div>
      )}

      {tab === 'edit' && (
        <div style={C.card}>
          <h3 style={C.h3}>✏️ 게시글 수정</h3>
          <div style={C.info('yellow')}>
            ⚠️ <strong>content</strong>: ENDED / CLOSED 상태에서만 수정 가능 &nbsp;|&nbsp;
            <strong>outfitItems</strong>: 모든 상태(OPEN 포함)에서 수정 가능 &nbsp;|&nbsp;
            <strong>게시글 숨김(hide)</strong>: ACTIVE 상태에서만 가능
          </div>
          <Field label="postId (수정할 게시글 ID)" value={postId} onChange={setPostId} placeholder="ex) 12" />
          <Field label="content (선택 — ENDED/CLOSED만 수정됨)" value={content} onChange={setContent}
            placeholder="수정할 본문 내용" />
          <div style={{ marginBottom: 8 }}>
            <span style={C.label}>outfitItems JSON 배열 (선택 — 전체 교체)</span>
            <textarea
              value={outfitRaw}
              onChange={e => setOutfitRaw(e.target.value)}
              placeholder={'[{"category":"TOP","itemName":"화이트셔츠","brand":"SPAO"}]'}
              style={{ ...C.input, height: 68, resize: 'vertical', fontFamily: 'monospace' }}
            />
          </div>
          <button style={C.btn('#ed8936')} onClick={() => {
            const body: Record<string, unknown> = {};
            if (content.trim()) body.content = content.trim();
            if (outfitRaw.trim()) {
              try { body.outfitItems = JSON.parse(outfitRaw); }
              catch { setRes('[Error] outfitItems JSON 파싱 실패 — 형식을 확인하세요'); return; }
            }
            if (!Object.keys(body).length) { setRes('[Error] content 또는 outfitItems 중 하나를 입력하세요'); return; }
            run(() => api('PATCH', `/posts/${postId}`, body), setRes);
          }}>PATCH /posts/:postId (수정)</button>
          <button style={C.btn('#e53e3e')} onClick={() =>
            run(() => api('PATCH', `/posts/${postId}/hide`, {}), setRes)
          }>PATCH /posts/:postId/hide (숨김)</button>
          <button style={C.btn('#718096')} onClick={() =>
            run(() => api('DELETE', `/posts/${postId}`), setRes)
          }>DELETE /posts/:postId (삭제)</button>
          <Result data={res} />
        </div>
      )}
    </>
  );
}

// ─── SECTION 6: 타 사용자 피드 ───────────────────────────────────────────────

function S_UserFeed() {
  const [userId, setUserId] = useState('');
  const [postId, setPostId] = useState('');
  const [res, setRes] = useState('');

  return (
    <>
      <div style={C.card}>
        <h3 style={C.h3}>👥 타 사용자 피드 목록 (랭킹 등재 게시글만)</h3>
        <div style={C.info('blue')}>
          ENDED + 랭킹 등재 게시글만 반환됩니다. OPEN(평가중) 게시글은 작성자 비공개 정책으로 제외.
        </div>
        <Field label="대상 userId" value={userId} onChange={setUserId} placeholder="조회할 유저 ID" />
        <button style={C.btn('#38a169')} onClick={() => run(() => api('GET', `/users/${userId}/feed`), setRes)}>
          GET /users/:userId/feed
        </button>
        <Result data={res} />
      </div>
      <div style={C.card}>
        <h3 style={C.h3}>🔍 타 사용자 피드 게시글 상세</h3>
        <Field label="대상 userId" value={userId} onChange={setUserId} placeholder="userId" />
        <Field label="postId" value={postId} onChange={setPostId} placeholder="postId" />
        <button style={C.btn('#2b6cb0')} onClick={() => run(() => api('GET', `/users/${userId}/feed/${postId}`), setRes)}>
          GET /users/:userId/feed/:postId
        </button>
        <Result data={res} />
      </div>
    </>
  );
}

// ─── SECTION 7: 검색 ──────────────────────────────────────────────────────────

function S_Search() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('ALL');
  const [res, setRes] = useState('');

  return (
    <div style={C.card}>
      <h3 style={C.h3}>🔍 통합 검색</h3>
      <div style={C.info('blue')}>
        OPEN(평가중) 게시글은 작성자 익명성 보호를 위해 검색 결과에서 제외됩니다.
        ENDED + 랭킹 등재 게시글만 POST 검색에 포함됩니다.
      </div>
      <Field label="검색어 (q — 1자 이상)" value={q} onChange={setQ}
        placeholder="닉네임 / 키워드 / 게시글 본문 내용" />
      <SelectField label="검색 타입" value={type} onChange={setType} options={[
        { value: 'ALL',      label: 'ALL — 통합 검색 (닉네임 + 키워드 + 게시글)' },
        { value: 'NICKNAME', label: 'NICKNAME — 닉네임 검색' },
        { value: 'KEYWORD',  label: 'KEYWORD — 태그 키워드 검색' },
        { value: 'POST',     label: 'POST — 게시글 본문(content) 검색' },
      ]} />
      <button style={C.btn('#2b6cb0')} onClick={() => {
        if (!q.trim()) { setRes('[Error] 검색어를 입력하세요'); return; }
        run(() => api('GET', `/search?q=${encodeURIComponent(q.trim())}&type=${type}`), setRes);
      }}>GET /search</button>
      <Result data={res} />
    </div>
  );
}

// ─── SECTION 8: 게시글 작성 ───────────────────────────────────────────────────

type UploadedImg = {
  originalImageUrl: string;
  processedImageUrl: string | null;
  thumbnailUrl: string | null;
  storageKey: string | null;
  blurMethod: 'NONE' | 'AUTO' | 'MANUAL';
  aiBlurStatus: 'NONE' | 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
};

type FlowStep = 'idle' | 'creating' | 'post_created';
type ModalType = 'none' | 'ai_success' | 'ai_failed';
type BlurDecision = 'accept' | 'manual';

const ASSET = 'http://localhost:3000';
const assetUrl = (url: string | null) =>
  url ? (url.startsWith('/') ? `${ASSET}${url}` : url) : null;

function BlurModal({
  type, img, onAccept, onManual, onCancel,
}: {
  type: ModalType;
  img: UploadedImg | null;
  onAccept: () => void;
  onManual: () => void;
  onCancel: () => void;
}) {
  if (type === 'none' || !img) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 28,
        maxWidth: 520, width: '92%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>

        {/* ── AI 실패 모달 ── */}
        {type === 'ai_failed' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 48 }}>⚠️</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#c53030', margin: '8px 0 4px' }}>
                AI 블러 처리 실패
              </h3>
              <p style={{ fontSize: 13, color: '#718096', lineHeight: 1.6 }}>
                AI가 얼굴을 감지하지 못했거나 처리에 실패했습니다.<br />
                현재 상태: <code style={{ background: '#fff5f5', color: '#c53030', padding: '1px 5px', borderRadius: 3 }}>
                  aiBlurStatus=FAILED · blurMethod=NONE
                </code>
              </p>
            </div>

            {/* 원본 이미지 미리보기 */}
            {assetUrl(img.originalImageUrl) && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#718096', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>
                  원본 이미지 (블러 미처리)
                </div>
                <img
                  src={assetUrl(img.originalImageUrl)!}
                  alt="원본"
                  style={{ width: '100%', borderRadius: 8, border: '2px solid #fc8181', maxHeight: 200, objectFit: 'cover' }}
                />
              </div>
            )}

            <div style={{ background: '#fff5f5', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: '#c53030', border: '1px solid #feb2b2' }}>
              <strong>수동 블러 처리 안내:</strong><br />
              게시글을 먼저 작성한 후, 직접 블러 처리한 이미지를 업로드할 수 있습니다.<br />
              (수동 블러 API는 postId가 필요하므로 게시글 작성 후 적용 가능합니다)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={onManual} style={{ ...C.btn('#e53e3e'), width: '100%', padding: '10px 0', fontSize: 13 }}>
                수동 블러 예정으로 게시글 작성 진행 →
              </button>
              <button onClick={onCancel} style={{ ...C.btn('#a0aec0'), width: '100%', padding: '10px 0', fontSize: 13 }}>
                취소 (다시 업로드)
              </button>
            </div>
          </>
        )}

        {/* ── AI 성공 모달 ── */}
        {type === 'ai_success' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 48 }}>✅</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#276749', margin: '8px 0 4px' }}>
                AI 블러 처리 성공
              </h3>
              <p style={{ fontSize: 12, color: '#718096' }}>
                처리 결과를 확인하고 게시글 작성 여부를 선택하세요.
              </p>
            </div>

            {/* 이미지 비교 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: '#718096', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>
                  원본
                </div>
                {assetUrl(img.originalImageUrl) ? (
                  <img src={assetUrl(img.originalImageUrl)!} alt="원본"
                    style={{ width: '100%', borderRadius: 8, border: '1px solid #e2e8f0', maxHeight: 160, objectFit: 'cover' }} />
                ) : (
                  <div style={{ background: '#f7fafc', borderRadius: 8, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#a0aec0' }}>없음</div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#276749', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>
                  AI 블러 처리됨 ✓
                </div>
                {assetUrl(img.processedImageUrl) ? (
                  <img src={assetUrl(img.processedImageUrl)!} alt="블러처리"
                    style={{ width: '100%', borderRadius: 8, border: '2px solid #68d391', maxHeight: 160, objectFit: 'cover' }} />
                ) : (
                  <div style={{ background: '#f7fafc', borderRadius: 8, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#a0aec0' }}>원본과 동일</div>
                )}
              </div>
            </div>

            <div style={{ background: '#f0fff4', borderRadius: 8, padding: 10, marginBottom: 16, fontSize: 11, color: '#276749', border: '1px solid #9ae6b4' }}>
              <strong>aiBlurStatus:</strong> DONE &nbsp;·&nbsp; <strong>blurMethod:</strong> AUTO
              <br />블러 결과가 정확하지 않다면 게시글 작성 후 수동으로 다시 처리할 수 있습니다.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={onAccept} style={{ ...C.btn('#38a169'), width: '100%', padding: '10px 0', fontSize: 13 }}>
                ✅ AI 블러 결과 확인 완료 — 게시글 작성 진행
              </button>
              <button onClick={onManual} style={{ ...C.btn('#d69e2e'), width: '100%', padding: '10px 0', fontSize: 13 }}>
                🔵 결과 부정확 — 수동 블러 예정으로 진행 (조건 ②)
              </button>
              <button onClick={onCancel} style={{ ...C.btn('#a0aec0'), width: '100%', padding: '10px 0', fontSize: 13 }}>
                취소
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function S_PostUpload() {
  const [flowStep, setFlowStep]         = useState<FlowStep>('idle');
  const [uploadedImg, setUploadedImg]   = useState<UploadedImg | null>(null);
  const [blurDecision, setBlurDecision] = useState<BlurDecision>('accept');
  const [modal, setModal]               = useState<ModalType>('none');
  const [createdPostId, setCreatedPostId] = useState<number | null>(null);
  const [manualBlurResult, setManualBlurResult] = useState<UploadedImg | null>(null);
  const [content, setContent]           = useState('');
  const [keywordIds, setKeywordIds]     = useState('');
  const [uploading, setUploading]       = useState(false);
  const [creating, setCreating]         = useState(false);
  const [blurring, setBlurring]         = useState(false);
  const [res, setRes]                   = useState('');
  const imgRef  = useRef<HTMLInputElement>(null);
  const blurRef = useRef<HTMLInputElement>(null);

  // ─── 스텝 인디케이터 ────────────────────────────────────────────────────────
  const steps = [
    { n: 1, label: '이미지 업로드', active: flowStep === 'idle' },
    { n: 2, label: '게시글 작성',   active: flowStep === 'creating' },
    { n: 3, label: '수동 블러',     active: flowStep === 'post_created' && blurDecision === 'manual' },
    { n: 4, label: '완료',          active: flowStep === 'post_created' && blurDecision === 'accept' },
  ];

  const reset = () => {
    setFlowStep('idle'); setUploadedImg(null); setBlurDecision('accept');
    setModal('none'); setCreatedPostId(null); setManualBlurResult(null);
    setContent(''); setKeywordIds(''); setRes('');
    if (imgRef.current)  imgRef.current.value  = '';
    if (blurRef.current) blurRef.current.value = '';
  };

  // ─── 1. 이미지 업로드 ───────────────────────────────────────────────────────
  const handleUpload = async () => {
    const f = imgRef.current?.files?.[0];
    if (!f) { setRes('[Error] 파일을 선택하세요'); return; }
    setUploading(true); setRes('');
    try {
      const fd = new FormData();
      fd.append('file', f);
      const d = await apiForm<UploadedImg>('POST', '/uploads/post-image', fd);
      setUploadedImg(d);
      setRes(fmt(d));
      // 결과에 따라 모달 결정
      if (d.aiBlurStatus === 'FAILED') {
        setModal('ai_failed');
      } else {
        setModal('ai_success');
      }
    } catch (e: unknown) {
      setRes(`[Error] ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  // ─── 2. 게시글 작성 ─────────────────────────────────────────────────────────
  const handleCreatePost = async () => {
    if (!uploadedImg) { setRes('[Error] 이미지 정보가 없습니다'); return; }
    if (!content.trim()) { setRes('[Error] content를 입력하세요'); return; }
    setCreating(true); setRes('');
    try {
      const body: Record<string, unknown> = { content: content.trim(), image: uploadedImg };
      if (keywordIds.trim()) {
        body.keywordIds = keywordIds.split(',').map(s => Number(s.trim())).filter(Boolean);
      }
      const d = await api<{ postId: number }>('POST', '/posts', body);
      setCreatedPostId(d.postId);
      setFlowStep('post_created');
      setRes(fmt(d));
    } catch (e: unknown) {
      setRes(`[Error] ${(e as Error).message}`);
    } finally {
      setCreating(false);
    }
  };

  // ─── 3. 수동 블러 ───────────────────────────────────────────────────────────
  const handleManualBlur = async () => {
    const f = blurRef.current?.files?.[0];
    if (!f) { setRes('[Error] 파일을 선택하세요'); return; }
    if (!createdPostId) { setRes('[Error] postId가 없습니다'); return; }
    setBlurring(true); setRes('');
    try {
      const fd = new FormData();
      fd.append('file', f);
      const d = await apiForm<UploadedImg>('PATCH', `/uploads/posts/${createdPostId}/manual-blur`, fd);
      setManualBlurResult(d);
      setRes(fmt(d));
    } catch (e: unknown) {
      setRes(`[Error] ${(e as Error).message}`);
    } finally {
      setBlurring(false);
    }
  };

  return (
    <>
      {/* ── 블러 확인 모달 ── */}
      <BlurModal
        type={modal}
        img={uploadedImg}
        onAccept={() => { setBlurDecision('accept'); setModal('none'); setFlowStep('creating'); }}
        onManual={() => { setBlurDecision('manual'); setModal('none'); setFlowStep('creating'); }}
        onCancel={() => { setModal('none'); setUploadedImg(null); setRes(''); if (imgRef.current) imgRef.current.value = ''; }}
      />

      {/* ── 스텝 인디케이터 ── */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, gap: 0 }}>
        {steps.map((step, i) => (
          <div key={step.n} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', border: '2px solid',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: step.active ? '#6b46c1' : (
                  (step.n === 1 && flowStep !== 'idle') ||
                  (step.n === 2 && flowStep === 'post_created') ? '#38a169' : '#e2e8f0'
                ),
                borderColor: step.active ? '#6b46c1' : (
                  (step.n === 1 && flowStep !== 'idle') ||
                  (step.n === 2 && flowStep === 'post_created') ? '#38a169' : '#e2e8f0'
                ),
                color: step.active || (step.n < 3 && flowStep === 'post_created') ? '#fff' : '#a0aec0',
              }}>{step.n}</div>
              <span style={{ fontSize: 10, color: step.active ? '#6b46c1' : '#a0aec0', fontWeight: step.active ? 700 : 400, whiteSpace: 'nowrap' }}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: '#e2e8f0', margin: '0 6px', marginBottom: 14 }} />
            )}
          </div>
        ))}
        <button onClick={reset} style={{ ...C.btn('#718096'), marginLeft: 12, fontSize: 11, padding: '4px 10px', marginTop: 0, marginBottom: 14 }}>
          처음부터
        </button>
      </div>

      {/* ── STEP 1: 이미지 업로드 ── */}
      {flowStep === 'idle' && (
        <div style={C.card}>
          <h3 style={C.h3}>📸 Step 1 — 이미지 업로드</h3>
          <div style={C.info('blue')}>
            업로드하면 서버에서 AI 자동 블러를 시도합니다.
            결과에 따라 확인 모달이 표시됩니다.
          </div>
          <div style={{ marginBottom: 10 }}>
            <span style={C.label}>이미지 파일 선택</span>
            <input ref={imgRef} type="file" accept="image/*" style={{ fontSize: 13 }} />
          </div>
          <button style={C.btn('#6b46c1')} onClick={handleUpload} disabled={uploading}>
            {uploading ? '업로드 중...' : 'POST /uploads/post-image'}
          </button>
          <Result data={res} />
        </div>
      )}

      {/* ── STEP 2: 게시글 작성 ── */}
      {flowStep === 'creating' && uploadedImg && (
        <div style={C.card}>
          <h3 style={C.h3}>📝 Step 2 — 게시글 작성</h3>

          {/* 이미지 상태 배지 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            background: blurDecision === 'accept' ? '#f0fff4' : '#fff5f5',
            border: `1px solid ${blurDecision === 'accept' ? '#9ae6b4' : '#feb2b2'}`,
            borderRadius: 8, marginBottom: 14,
          }}>
            <div style={{ flex: 'none' }}>
              {assetUrl(uploadedImg.processedImageUrl ?? uploadedImg.originalImageUrl) && (
                <img
                  src={assetUrl(uploadedImg.processedImageUrl ?? uploadedImg.originalImageUrl)!}
                  alt="미리보기"
                  style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }}
                />
              )}
            </div>
            <div style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>
                {blurDecision === 'accept' ? '✅ AI 블러 완료' : '⚠️ 수동 블러 예정'}
              </div>
              <div style={{ color: '#718096' }}>
                aiBlurStatus: <strong>{uploadedImg.aiBlurStatus}</strong> &nbsp;·&nbsp;
                blurMethod: <strong>{uploadedImg.blurMethod}</strong>
              </div>
              {blurDecision === 'manual' && (
                <div style={{ color: '#c53030', marginTop: 2, fontSize: 11 }}>
                  게시글 작성 후 수동 블러를 적용합니다
                </div>
              )}
            </div>
          </div>

          <Field label="본문 content (필수, 최대 500자)" value={content} onChange={setContent}
            placeholder="봄 코디 평가 부탁드립니다!" />
          <Field label="키워드 ID 목록 (쉼표 구분, 선택 — 예: 1,3)" value={keywordIds}
            onChange={setKeywordIds} placeholder="1,3" />

          <div style={{ marginBottom: 12, padding: '8px 10px', background: '#f7fafc', borderRadius: 6, fontSize: 11, color: '#718096', fontFamily: 'monospace' }}>
            outfitItems 예시: [{'"category":"TOP","itemName":"화이트셔츠","brand":"SPAO"'}]
          </div>

          <button style={C.btn('#6b46c1')} onClick={handleCreatePost} disabled={creating}>
            {creating ? '작성 중...' : 'POST /posts'}
          </button>
          <Result data={res} />
        </div>
      )}

      {/* ── STEP 3 / 4: 게시글 작성 완료 ── */}
      {flowStep === 'post_created' && (
        <>
          <div style={{ ...C.info('green'), display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🎉</span>
            <div>
              <strong>게시글 작성 완료!</strong> postId: <strong>{createdPostId}</strong>
              {blurDecision === 'accept' && <span> — AI 블러 처리된 이미지로 업로드되었습니다.</span>}
              {blurDecision === 'manual' && <span style={{ color: '#e53e3e' }}> — 아래에서 수동 블러를 적용해 주세요.</span>}
            </div>
          </div>

          {/* 수동 블러 섹션 (blurDecision === 'manual' 이거나 직접 원할 때) */}
          <div style={C.card}>
            <h3 style={C.h3}>
              {blurDecision === 'manual' ? '🔵 Step 3 — 수동 블러 적용 (필수)' : '🔵 수동 블러 재적용 (선택)'}
            </h3>

            {blurDecision === 'manual' && (
              <div style={C.info('red')}>
                게시글이 생성되었지만 아직 블러 처리가 되지 않았습니다.
                직접 블러 처리한 이미지를 아래에서 업로드해 주세요.
              </div>
            )}

            <div style={{ marginBottom: 8, padding: '8px 10px', background: '#fffbeb', borderRadius: 6, fontSize: 11, color: '#7c4a03', border: '1px solid #f6e05e' }}>
              <strong>현재 postId: {createdPostId}</strong> (자동 입력됨)<br />
              허용 조건: ① FAILED+NONE &nbsp;② DONE+AUTO (override) &nbsp;③ MANUAL 재처리
            </div>

            <div style={{ marginBottom: 8 }}>
              <span style={C.label}>직접 블러 처리한 이미지 파일</span>
              <input ref={blurRef} type="file" accept="image/*" style={{ fontSize: 13 }} />
            </div>
            <button style={C.btn('#d69e2e')} onClick={handleManualBlur} disabled={blurring}>
              {blurring ? '적용 중...' : `PATCH /uploads/posts/${createdPostId}/manual-blur`}
            </button>

            {/* 수동 블러 결과 미리보기 */}
            {manualBlurResult && (
              <div style={{ marginTop: 14 }}>
                <div style={{ ...C.info('green'), display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>✅</span>
                  <div>
                    <strong>수동 블러 적용 완료!</strong>
                    <span style={{ marginLeft: 8, fontSize: 11 }}>
                      blurMethod → <strong>MANUAL</strong> &nbsp;/&nbsp; aiBlurStatus: {uploadedImg?.aiBlurStatus} (보존)
                    </span>
                  </div>
                </div>
                {assetUrl(manualBlurResult.processedImageUrl) && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: '#718096', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase' }}>
                      수동 블러 처리 완료 이미지
                    </div>
                    <img
                      src={assetUrl(manualBlurResult.processedImageUrl)!}
                      alt="수동블러결과"
                      style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8, border: '2px solid #68d391' }}
                    />
                  </div>
                )}
              </div>
            )}
            <Result data={res} />
          </div>
        </>
      )}
    </>
  );
}

// ─── SECTION 9: 평가존 ────────────────────────────────────────────────────────

function S_Evaluation() {
  const [tab, setTab]                 = useState<'list' | 'detail' | 'vote'>('list');
  const [postId, setPostId]           = useState('');
  const [choice, setChoice]           = useState<'LIKE' | 'DISLIKE'>('LIKE');
  const [voteId, setVoteId]           = useState('');
  const [tags, setTags]               = useState<{ id: number; label: string; code: string }[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<number>>(new Set());
  const [res, setRes]                 = useState('');

  const toggleTag = (id: number) => {
    const next = new Set(selectedTags);
    if (next.has(id)) {
      next.delete(id);
    } else if (next.size >= 3) {
      setRes('[Error] 피드백 태그는 최대 3개까지만 선택할 수 있습니다 (V2 정책)');
      return;
    } else {
      next.add(id);
    }
    setSelectedTags(next);
    setRes('');
  };

  const tabs = [
    { key: 'list'   as const, label: '📋 평가 목록' },
    { key: 'detail' as const, label: '🔍 평가 상세' },
    { key: 'vote'   as const, label: '🗳️ 투표 + 피드백' },
  ];

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setRes(''); }}
            style={C.tab(tab === t.key, '#b7791f')}>{t.label}</button>
        ))}
      </div>

      {tab === 'list' && (
        <div style={C.card}>
          <h3 style={C.h3}>📋 평가존 목록</h3>
          <div style={C.info('blue')}>
            본인 게시글 제외 + 이미 투표한 게시글 제외. OPEN 상태 게시글만 반환됩니다.
          </div>
          <button style={C.btn('#b7791f')} onClick={() => run(() => api('GET', '/evaluations'), setRes)}>
            GET /evaluations
          </button>
          <Result data={res} />
        </div>
      )}

      {tab === 'detail' && (
        <div style={C.card}>
          <h3 style={C.h3}>🔍 평가 게시글 상세</h3>
          <div style={C.info('blue')}>
            작성자 정보(닉네임, 프로필)는 OPEN 상태에서 비공개 처리됩니다.
            투표 여부(hasVoted), 내 투표 선택(myVoteChoice), 피드백 태그 요약도 포함됩니다.
          </div>
          <Field label="postId" value={postId} onChange={setPostId} placeholder="평가할 게시글 ID" />
          <button style={C.btn('#b7791f')} onClick={() => run(() => api('GET', `/evaluations/posts/${postId}`), setRes)}>
            GET /evaluations/posts/:postId
          </button>
          <Result data={res} />
        </div>
      )}

      {tab === 'vote' && (
        <>
          <div style={C.card}>
            <h3 style={C.h3}>🗳️ 투표 (LIKE / DISLIKE)</h3>
            <div style={C.info('blue')}>
              투표 성공 시 voteId가 반환됩니다. 아래 피드백 태그 선택에 voteId가 자동 입력됩니다.
            </div>
            <Field label="게시글 ID (postId)" value={postId} onChange={setPostId} placeholder="투표할 게시글 ID" />
            <div style={{ marginBottom: 10 }}>
              <span style={C.label}>투표 선택</span>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['LIKE', 'DISLIKE'] as const).map(c => (
                  <button key={c} onClick={() => setChoice(c)} style={{
                    padding: '8px 24px', borderRadius: 8, border: '2px solid',
                    cursor: 'pointer', fontSize: 14, fontWeight: 700,
                    background: choice === c ? (c === 'LIKE' ? '#38a169' : '#e53e3e') : '#fff',
                    color: choice === c ? '#fff' : (c === 'LIKE' ? '#38a169' : '#e53e3e'),
                    borderColor: c === 'LIKE' ? '#38a169' : '#e53e3e',
                  }}>
                    {c === 'LIKE' ? '👍 좋아요' : '👎 싫어요'}
                  </button>
                ))}
              </div>
            </div>
            <button style={C.btn(choice === 'LIKE' ? '#38a169' : '#e53e3e')} onClick={() => run(async () => {
              const d = await api<{ voteId: number }>('POST', `/evaluations/posts/${postId}/votes`, { choice });
              setVoteId(String(d.voteId));
              setSelectedTags(new Set());
              setTags([]);
              return d;
            }, setRes)}>POST /evaluations/posts/:postId/votes</button>
            <Result data={res} />
          </div>

          <div style={C.card}>
            <h3 style={C.h3}>🏷️ 피드백 태그 선택 (최대 3개 — V2 정책)</h3>
            <div style={C.info('yellow')}>
              ⚠️ 피드백 태그는 <strong>투표 직후 1회만</strong> 제출 가능합니다. 이후 수정/삭제 불가.
              최대 <strong>3개</strong>까지 선택할 수 있습니다.
            </div>
            <Field label="voteId (투표 후 자동 입력됨)" value={voteId} onChange={setVoteId}
              placeholder="투표 후 자동 입력" />
            <button style={C.btn('#718096')} onClick={() => {
              run(async () => {
                const d = await api<{ items: { id: number; label: string; code: string }[] }>(
                  'GET', `/evaluations/tags?voteChoice=${choice}`
                );
                setTags(d.items);
                return d;
              }, setRes);
            }}>태그 목록 불러오기 (voteChoice: {choice})</button>

            {tags.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, marginBottom: 8 }}>
                  선택됨: <strong style={{ color: selectedTags.size === 3 ? '#e53e3e' : '#2b6cb0' }}>
                    {selectedTags.size} / 3
                  </strong>
                  {selectedTags.size === 3 && <span style={{ color: '#e53e3e', marginLeft: 6 }}>최대 선택!</span>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {tags.map(tag => {
                    const sel = selectedTags.has(tag.id);
                    const disabled = !sel && selectedTags.size >= 3;
                    return (
                      <button key={tag.id} onClick={() => toggleTag(tag.id)} style={{
                        padding: '6px 14px', borderRadius: 20, border: '2px solid',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontSize: 12, fontWeight: sel ? 700 : 400,
                        background: sel ? '#b7791f' : '#fff',
                        color: sel ? '#fff' : disabled ? '#a0aec0' : '#4a5568',
                        borderColor: sel ? '#b7791f' : disabled ? '#e2e8f0' : '#cbd5e0',
                        opacity: disabled ? 0.5 : 1,
                      }}>{tag.label}</button>
                    );
                  })}
                </div>
                <button
                  style={{ ...C.btn('#b7791f'), marginTop: 12 }}
                  onClick={() => {
                    if (!voteId) { setRes('[Error] voteId가 없습니다. 먼저 투표하세요'); return; }
                    if (selectedTags.size === 0) { setRes('[Error] 태그를 1개 이상 선택하세요'); return; }
                    run(() => api('POST', `/evaluations/votes/${voteId}/feedback`, {
                      tagIds: Array.from(selectedTags),
                    }), setRes);
                  }}
                >
                  POST /evaluations/votes/:voteId/feedback ({selectedTags.size}개 선택)
                </button>
              </div>
            )}
            <Result data={res} />
          </div>
        </>
      )}
    </>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { key: 'login',      label: '🔐 로그인',           component: S_Login },
  { key: 'mypage',     label: '👤 마이페이지',        component: S_MyPage },
  { key: 'admin',      label: '🛡️ 관리자',           component: S_Admin },
  { key: 'bookmark',   label: '🔖 북마크',            component: S_Bookmarks },
  { key: 'myfeed',     label: '📋 내 피드',           component: S_MyFeed },
  { key: 'userfeed',   label: '👥 타 사용자 피드',    component: S_UserFeed },
  { key: 'search',     label: '🔍 검색',              component: S_Search },
  { key: 'upload',     label: '📝 게시글 작성',       component: S_PostUpload },
  { key: 'evaluation', label: '🎯 평가존',            component: S_Evaluation },
];

export default function TestPage() {
  const [active, setActive] = useState('login');
  const ActiveSection = SECTIONS.find(sec => sec.key === active)?.component ?? S_Login;

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'Pretendard', 'Inter', -apple-system, sans-serif", background: '#f7fafc' }}>
      {/* ── 사이드바 ── */}
      <aside style={{
        width: 210, background: '#1a202c', display: 'flex',
        flexDirection: 'column', flexShrink: 0, overflowY: 'auto',
      }}>
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid #2d3748' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>C:dinator V2</div>
          <div style={{ fontSize: 11, color: '#4a5568', marginTop: 3 }}>API Test Panel</div>
        </div>

        <nav style={{ padding: '8px 0', flex: 1 }}>
          {SECTIONS.map(sec => (
            <button
              key={sec.key}
              onClick={() => setActive(sec.key)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 16px', background: active === sec.key ? '#2d3748' : 'transparent',
                border: 'none',
                borderLeft: `3px solid ${active === sec.key ? '#63b3ed' : 'transparent'}`,
                color: active === sec.key ? '#fff' : '#718096',
                fontSize: 13, cursor: 'pointer', fontWeight: active === sec.key ? 700 : 400,
                transition: 'all 0.1s',
              }}
            >{sec.label}</button>
          ))}
        </nav>

        <div style={{ padding: '10px 16px', borderTop: '1px solid #2d3748', fontSize: 11 }}>
          {tok()
            ? <span style={{ color: '#68d391' }}>✅ uid: {localStorage.getItem('userId')} / {localStorage.getItem('nickname')}</span>
            : <span style={{ color: '#fc8181' }}>⚠️ 로그인 필요</span>}
        </div>
      </aside>

      {/* ── 콘텐츠 ── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <div style={{ maxWidth: 740 }}>
          <ActiveSection />
        </div>
      </main>
    </div>
  );
}
