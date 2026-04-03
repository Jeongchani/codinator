/**
 * C:dinator V2 API 통합 테스트 페이지
 * 사용법: App.tsx에 <Route path="/test" element={<TestPage />} /> 추가 후 /test 접속
 */

import { useState, useRef, useEffect, useCallback } from 'react';

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
    const msg =
      raw && typeof raw === 'object' && 'message' in raw
        ? Array.isArray(raw.message)
          ? (raw.message as string[]).join(', ')
          : String(raw.message)
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
    const msg =
      raw && typeof raw === 'object' && 'message' in raw ? String(raw.message) : text;
    throw new Error(`[${res.status}] ${msg}`);
  }
  return d as T;
}

const fmt = (v: unknown) => JSON.stringify(v, null, 2);

function run<T>(fn: () => Promise<T>, set: (s: string) => void) {
  fn()
    .then((d) => set(fmt(d)))
    .catch((e: Error) => set(`[Error] ${e.message}`));
}

// ─── 공통 UI ─────────────────────────────────────────────────────────────────

const C = {
  card: {
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
    background: '#fff',
  } as React.CSSProperties,
  label: {
    fontSize: 11,
    color: '#718096',
    display: 'block',
    marginBottom: 4,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '7px 10px',
    border: '1px solid #cbd5e0',
    borderRadius: 6,
    fontSize: 13,
    boxSizing: 'border-box' as const,
    outline: 'none',
  } as React.CSSProperties,
  btn: (color = '#4299e1'): React.CSSProperties => ({
    padding: '7px 14px',
    background: color,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    marginRight: 6,
    marginTop: 4,
  }),
  tab: (active: boolean, color = '#4299e1'): React.CSSProperties => ({
    padding: '7px 14px',
    background: active ? color : '#edf2f7',
    color: active ? '#fff' : '#4a5568',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    marginRight: 6,
  }),
  h3: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 12,
    color: '#1a202c',
  } as React.CSSProperties,
  info: (color: 'blue' | 'yellow' | 'green' | 'red' = 'blue'): React.CSSProperties => {
    const map = {
      blue:   { bg: '#ebf8ff', border: '#bee3f8', text: '#2b6cb0' },
      yellow: { bg: '#fffbeb', border: '#f6e05e', text: '#7c4a03' },
      green:  { bg: '#f0fff4', border: '#9ae6b4', text: '#276749' },
      red:    { bg: '#fff5f5', border: '#feb2b2', text: '#c53030' },
    }[color];
    return {
      padding: '8px 10px',
      background: map.bg,
      border: `1px solid ${map.border}`,
      color: map.text,
      borderRadius: 6,
      fontSize: 11,
      marginBottom: 10,
    };
  },
};

function Field({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <span style={C.label}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={C.input}
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <span style={C.label}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...C.input, width: 220 }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
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
      <button
        style={C.btn('#2b6cb0')}
        onClick={() =>
          run(async () => {
            const d = await api<{
              accessToken: string; refreshToken?: string;
              user: { id: number; nickname: string };
            }>('POST', '/auth/login', { email, password: pw });
            localStorage.setItem('accessToken', d.accessToken);
            if (d.refreshToken) localStorage.setItem('refreshToken', d.refreshToken);
            localStorage.setItem('userId', String(d.user.id));
            localStorage.setItem('nickname', d.user.nickname);
            return { '✅ 로그인 성공': true, userId: d.user.id, nickname: d.user.nickname };
          }, setRes)
        }
      >
        POST /auth/login
      </button>
      <button
        style={C.btn('#718096')}
        onClick={() => {
          localStorage.clear();
          setRes(fmt({ message: '로그아웃 완료 (로컬 토큰 삭제)' }));
        }}
      >
        로그아웃 (토큰 삭제)
      </button>
      {tok() && (
        <div style={{ ...C.info('green'), marginTop: 8 }}>
          ✅ 현재 토큰 보유 — userId: <strong>{localStorage.getItem('userId')}</strong> / 닉네임:{' '}
          <strong>{localStorage.getItem('nickname')}</strong>
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
        <button
          style={C.btn('#ed8936')}
          onClick={() => {
            const body: Record<string, string> = {};
            if (nickname.trim()) body.nickname = nickname.trim();
            if (phone.trim()) body.phoneNumber = phone.trim();
            if (!Object.keys(body).length) {
              setRes('[Error] 닉네임 또는 전화번호를 입력하세요');
              return;
            }
            run(() => api('PATCH', '/users/me', body), setRes);
          }}
        >
          PATCH /users/me
        </button>
        <Result data={res} />
      </div>

      <div style={C.card}>
        <h3 style={C.h3}>🔒 비밀번호 변경</h3>
        <Field label="현재 비밀번호" value={curPw} onChange={setCurPw} type="password" />
        <Field label="새 비밀번호" value={newPw} onChange={setNewPw} type="password" />
        <button
          style={C.btn('#e53e3e')}
          onClick={() =>
            run(
              () => api('PATCH', '/users/me/password', { currentPassword: curPw, newPassword: newPw }),
              setRes,
            )
          }
        >
          PATCH /users/me/password
        </button>
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
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setRes(''); }}
            style={C.tab(tab === t.key, '#553c9a')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === 'postList' || tab === 'userList') && (
        <div style={C.card}>
          <h3 style={C.h3}>{tab === 'postList' ? '📋 게시글 신고 목록' : '👥 사용자 신고 목록'}</h3>
          <SelectField
            label="상태 필터"
            value={status}
            onChange={setStatus}
            options={[
              { value: '', label: '전체' },
              { value: 'PENDING', label: 'PENDING (미처리)' },
              { value: 'RESOLVED', label: 'RESOLVED (처리 완료)' },
              { value: 'REJECTED', label: 'REJECTED (반려)' },
            ]}
          />
          <button
            style={C.btn('#553c9a')}
            onClick={() => {
              const qs = status ? `?status=${status}` : '';
              const path = tab === 'postList' ? `/admin/post-reports${qs}` : `/admin/user-reports${qs}`;
              run(() => api('GET', path), setRes);
            }}
          >
            조회
          </button>
          <Result data={res} />
        </div>
      )}

      {tab === 'handlePost' && (
        <div style={C.card}>
          <h3 style={C.h3}>✅ 게시글 신고 처리</h3>
          <div style={C.info('blue')}>신고 목록에서 reportId를 확인한 후 입력하세요.</div>
          <Field label="신고 ID (reportId)" value={reportId} onChange={setReportId} placeholder="ex) 3" />
          <SelectField
            label="처리 결과"
            value={action}
            onChange={setAction}
            options={[
              { value: 'RESOLVED', label: 'RESOLVED — 신고 처리 완료' },
              { value: 'REJECTED', label: 'REJECTED — 신고 반려' },
            ]}
          />
          <button
            style={C.btn('#e53e3e')}
            onClick={() => run(() => api('PATCH', `/admin/post-reports/${reportId}`, { action }), setRes)}
          >
            PATCH /admin/post-reports/:reportId
          </button>
          <Result data={res} />
        </div>
      )}

      {tab === 'handleUser' && (
        <div style={C.card}>
          <h3 style={C.h3}>✅ 사용자 신고 처리</h3>
          <Field label="신고 ID (reportId)" value={reportId} onChange={setReportId} placeholder="ex) 5" />
          <SelectField
            label="처리 결과"
            value={action}
            onChange={setAction}
            options={[
              { value: 'RESOLVED', label: 'RESOLVED — 신고 처리 완료' },
              { value: 'REJECTED', label: 'REJECTED — 신고 반려' },
            ]}
          />
          <button
            style={C.btn('#e53e3e')}
            onClick={() => run(() => api('PATCH', `/admin/user-reports/${reportId}`, { action }), setRes)}
          >
            PATCH /admin/user-reports/:reportId
          </button>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#4a5568' }}>
              🚫 게시글 상태 강제 변경 (ADMIN)
            </h4>
            <Field label="게시글 ID (postId)" value={postId} onChange={setPostId} placeholder="ex) 12" />
            <SelectField
              label="변경할 상태"
              value={postStatus}
              onChange={setPostStatus}
              options={[
                { value: 'ACTIVE', label: 'ACTIVE — 숨김 해제' },
                { value: 'HIDDEN', label: 'HIDDEN — 숨김' },
                { value: 'DELETED', label: 'DELETED — 삭제' },
              ]}
            />
            {postStatus === 'HIDDEN' && (
              <Field
                label="숨김 사유 (선택, 최대 255자)"
                value={hiddenReason}
                onChange={setHiddenReason}
                placeholder="커뮤니티 가이드라인 위반"
              />
            )}
            <button
              style={C.btn('#553c9a')}
              onClick={() => {
                const body: Record<string, unknown> = { status: postStatus };
                if (postStatus === 'HIDDEN' && hiddenReason.trim()) body.hiddenReason = hiddenReason.trim();
                run(() => api('PATCH', `/admin/posts/${postId}/status`, body), setRes);
              }}
            >
              PATCH /admin/posts/:postId/status
            </button>
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
        <button
          style={C.btn('#38a169')}
          onClick={() => run(() => api('GET', '/users/me/bookmarks'), setRes)}
        >
          GET /users/me/bookmarks
        </button>
        <Result data={res} />
      </div>
      <div style={C.card}>
        <h3 style={C.h3}>➕ 북마크 추가</h3>
        <div style={C.info('blue')}>OPEN / ENDED / CLOSED 상태 게시글 모두 북마크 가능합니다.</div>
        <Field label="게시글 ID (postId)" value={postId} onChange={setPostId} placeholder="ex) 12" />
        <button
          style={C.btn('#ed8936')}
          onClick={() => run(() => api('POST', `/posts/${postId}/bookmarks`), setRes)}
        >
          POST /posts/:postId/bookmarks
        </button>
        <Result data={res} />
      </div>
      <div style={C.card}>
        <h3 style={C.h3}>🗑️ 북마크 삭제</h3>
        <Field label="게시글 ID (postId)" value={postId} onChange={setPostId} placeholder="ex) 12" />
        <button
          style={C.btn('#e53e3e')}
          onClick={() => run(() => api('DELETE', `/posts/${postId}/bookmarks`), setRes)}
        >
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

  const filtered = (allItems as unknown as FeedItem[]).filter((item) => {
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
        💡 <strong>게시글 수정 위치 제안:</strong> 실제 서비스에서는 <code>MyFeedDetail</code> 페이지 내부에
        수정 버튼을 배치하는 것이 자연스럽습니다.
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setRes(''); }}
            style={C.tab(tab === t.key, '#2b6cb0')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <div style={C.card}>
          <h3 style={C.h3}>📋 내 피드 목록 (상태 필터)</h3>
          <div style={C.info('blue')}>
            서버에서 전체 목록을 가져온 뒤 클라이언트에서 필터합니다.
            OPEN=평가중, ENDED=평가완료, HIDDEN=숨김 처리됨.
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {(['ALL', 'OPEN', 'ENDED', 'HIDDEN'] as const).map((f) => {
              const colorMap = { ALL: '#4a5568', OPEN: '#38a169', ENDED: '#2b6cb0', HIDDEN: '#e53e3e' };
              const active = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: `2px solid ${colorMap[f]}`,
                    background: active ? colorMap[f] : '#fff', color: active ? '#fff' : colorMap[f],
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {f}
                </button>
              );
            })}
          </div>
          <button
            style={C.btn('#38a169')}
            onClick={() => {
              api<{ items: Record<string, unknown>[] }>('GET', '/users/me/feed')
                .then((d) => { setAllItems(d.items); setRes(fmt(d)); })
                .catch((e: Error) => setRes(`[Error] ${e.message}`));
            }}
          >
            GET /users/me/feed
          </button>
          {allItems.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: '#718096', marginBottom: 6 }}>
                전체 {allItems.length}건 → <strong>{filter}</strong> 필터 결과: {filtered.length}건
              </div>
              {filtered.map((item) => (
                <div
                  key={item.postId}
                  style={{
                    padding: '8px 12px', background: '#f7fafc', borderRadius: 6, marginBottom: 4,
                    fontSize: 12, border: '1px solid #e2e8f0', display: 'flex', gap: 10, alignItems: 'center',
                  }}
                >
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
          <button
            style={C.btn('#2b6cb0')}
            onClick={() => run(() => api('GET', `/users/me/feed/${postId}`), setRes)}
          >
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
          <Field
            label="content (선택 — ENDED/CLOSED만 수정됨)"
            value={content}
            onChange={setContent}
            placeholder="수정할 본문 내용"
          />
          <div style={{ marginBottom: 8 }}>
            <span style={C.label}>outfitItems JSON 배열 (선택 — 전체 교체)</span>
            <textarea
              value={outfitRaw}
              onChange={(e) => setOutfitRaw(e.target.value)}
              placeholder={'[{"category":"TOP","itemName":"화이트셔츠","brand":"SPAO"}]'}
              style={{ ...C.input, height: 68, resize: 'vertical', fontFamily: 'monospace' }}
            />
          </div>
          <button
            style={C.btn('#ed8936')}
            onClick={() => {
              const body: Record<string, unknown> = {};
              if (content.trim()) body.content = content.trim();
              if (outfitRaw.trim()) {
                try { body.outfitItems = JSON.parse(outfitRaw); }
                catch { setRes('[Error] outfitItems JSON 파싱 실패'); return; }
              }
              if (!Object.keys(body).length) {
                setRes('[Error] content 또는 outfitItems 중 하나를 입력하세요');
                return;
              }
              run(() => api('PATCH', `/posts/${postId}`, body), setRes);
            }}
          >
            PATCH /posts/:postId (수정)
          </button>
          <button
            style={C.btn('#e53e3e')}
            onClick={() => run(() => api('PATCH', `/posts/${postId}/hide`, {}), setRes)}
          >
            PATCH /posts/:postId/hide (숨김)
          </button>
          <button
            style={C.btn('#718096')}
            onClick={() => run(() => api('DELETE', `/posts/${postId}`), setRes)}
          >
            DELETE /posts/:postId (삭제)
          </button>
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
        <button
          style={C.btn('#38a169')}
          onClick={() => run(() => api('GET', `/users/${userId}/feed`), setRes)}
        >
          GET /users/:userId/feed
        </button>
        <Result data={res} />
      </div>
      <div style={C.card}>
        <h3 style={C.h3}>🔍 타 사용자 피드 게시글 상세</h3>
        <Field label="대상 userId" value={userId} onChange={setUserId} placeholder="userId" />
        <Field label="postId" value={postId} onChange={setPostId} placeholder="postId" />
        <button
          style={C.btn('#2b6cb0')}
          onClick={() => run(() => api('GET', `/users/${userId}/feed/${postId}`), setRes)}
        >
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
      <Field
        label="검색어 (q — 1자 이상)"
        value={q}
        onChange={setQ}
        placeholder="닉네임 / 키워드 / 게시글 본문 내용"
      />
      <SelectField
        label="검색 타입"
        value={type}
        onChange={setType}
        options={[
          { value: 'ALL',      label: 'ALL — 통합 검색 (닉네임 + 키워드 + 게시글)' },
          { value: 'NICKNAME', label: 'NICKNAME — 닉네임 검색' },
          { value: 'KEYWORD',  label: 'KEYWORD — 태그 키워드 검색' },
          { value: 'POST',     label: 'POST — 게시글 본문(content) 검색' },
        ]}
      />
      <button
        style={C.btn('#2b6cb0')}
        onClick={() => {
          if (!q.trim()) { setRes('[Error] 검색어를 입력하세요'); return; }
          run(() => api('GET', `/search?q=${encodeURIComponent(q.trim())}&type=${type}`), setRes);
        }}
      >
        GET /search
      </button>
      <Result data={res} />
    </div>
  );
}

// ─── SECTION 8: 게시글 작성 (수동 블러 캔버스 편집기) ────────────────────────

/** 업로드 API 응답 */
type UploadedImg = {
  originalImageUrl: string;
  processedImageUrl: string | null;
  thumbnailUrl: string | null;
  storageKey: string | null;
  blurMethod: 'NONE' | 'AUTO' | 'MANUAL';
  aiBlurStatus: 'NONE' | 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
};

/** 수동 블러 박스 영역 — display(CSS px) 좌표 기준 */
type BlurRegion = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** 드래그/리사이즈 인터랙션 상태 (ref에 저장 — 렌더 불필요) */
type InteractionState =
  | { type: 'none' }
  | { type: 'move';   id: number; startX: number; startY: number; origX: number; origY: number }
  | { type: 'resize'; id: number; startX: number; startY: number; origW: number; origH: number };

/** 게시글 작성 플로우 스텝 */
type PostFlowStep = 'idle' | 'blur_decision' | 'manual_editor' | 'creating' | 'done';
type BlurChoice   = 'auto' | 'manual';

const ASSET    = 'http://localhost:3000';
const assetUrl = (url: string | null) =>
  url ? (url.startsWith('/') ? `${ASSET}${url}` : url) : null;

/** 에디터 내 이미지 표시 너비 (px) — 고정값 */
const EDITOR_IMG_W = 460;

// ── 공통 모달 래퍼 ─────────────────────────────────────────────────────────
function Modal({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '24px 16px', overflowY: 'auto',
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 24,
        maxWidth: wide ? 740 : 540, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        marginTop: 16, marginBottom: 16,
      }}>
        {children}
      </div>
    </div>
  );
}

// ── 이미지 비교 패널 (contain으로 얼굴 안 잘림) ───────────────────────────
function ImgCompare({
  img, manualPreview,
}: {
  img: UploadedImg;
  manualPreview?: string | null;
}) {
  const origUrl    = assetUrl(img.originalImageUrl);
  const aiUrl      = assetUrl(img.processedImageUrl);
  const showManual = !!manualPreview;
  const cols       = showManual ? '1fr 1fr 1fr' : '1fr 1fr';

  const imgStyle: React.CSSProperties = {
    width: '100%',
    maxHeight: 260,
    objectFit: 'contain',
    borderRadius: 8,
    background: '#f7fafc',
    display: 'block',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, marginBottom: 16 }}>
      {/* 원본 */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#718096', textTransform: 'uppercase', textAlign: 'center', marginBottom: 6 }}>원본</div>
        {origUrl
          ? <img src={origUrl} alt="원본" style={{ ...imgStyle, border: '1px solid #e2e8f0' }} />
          : <div style={{ height: 120, background: '#f7fafc', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#a0aec0' }}>없음</div>}
      </div>

      {/* AI 블러 */}
      <div>
        <div style={{
          fontSize: 10, fontWeight: 700, textAlign: 'center', marginBottom: 6,
          color: img.aiBlurStatus === 'FAILED' ? '#c53030' : '#276749',
          textTransform: 'uppercase',
        }}>
          AI 블러 {img.aiBlurStatus === 'FAILED' ? '❌ 실패' : `✅ ${img.aiBlurStatus}`}
        </div>
        {aiUrl && img.aiBlurStatus !== 'FAILED'
          ? <img src={aiUrl} alt="AI블러" style={{ ...imgStyle, border: `2px solid #68d391` }} />
          : <div style={{ height: 120, background: '#fff5f5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#c53030', border: '2px solid #fc8181' }}>
              블러 미처리
            </div>}
      </div>

      {/* 수동 블러 미리보기 */}
      {showManual && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#d69e2e', textTransform: 'uppercase', textAlign: 'center', marginBottom: 6 }}>수동 블러 🔵</div>
          <img src={manualPreview!} alt="수동블러" style={{ ...imgStyle, border: '2px solid #d69e2e' }} />
        </div>
      )}
    </div>
  );
}

// ── 수동 블러 캔버스 편집기 ────────────────────────────────────────────────
function ManualBlurEditor({
  originalImageUrl,
  onApprove,
  onCancel,
}: {
  originalImageUrl: string;
  /** 승인 시 최종 File + 미리보기 dataURL 전달 */
  onApprove: (file: File, previewDataUrl: string) => void;
  onCancel: () => void;
}) {
  // 원본 이미지를 blob URL로 로드 (CORS/캔버스 오염 방지)
  const [blobUrl, setBlobUrl]   = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // 블러 박스 목록 (display 좌표)
  const [regions, setRegions]     = useState<BlurRegion[]>([
    { id: 1, x: 60, y: 60, width: 140, height: 140 },
  ]);
  const [selectedId, setSelectedId] = useState<number | null>(1);

  // 미리보기 dataURL
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving]   = useState(false);

  const imgRef       = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nextId       = useRef(2);
  const interaction  = useRef<InteractionState>({ type: 'none' });

  // 이미지 fetch → blob URL (same-origin으로 canvas 오염 없음)
  useEffect(() => {
    let objUrl: string | null = null;
    fetch(originalImageUrl, { headers: { Authorization: `Bearer ${tok()}` } })
      .then((r) => r.blob())
      .then((blob) => {
        objUrl = URL.createObjectURL(blob);
        setBlobUrl(objUrl);
      })
      .catch(() => {
        // 인증 불필요 경로면 직접 사용
        setBlobUrl(originalImageUrl);
      });
    return () => { if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [originalImageUrl]);

  // window 레벨 mousemove / mouseup (컨테이너 밖으로 나가도 동작)
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const ia = interaction.current;
    if (ia.type === 'none') return;

    const dx = e.clientX - ia.startX;
    const dy = e.clientY - ia.startY;
    const id = ia.id;

    if (ia.type === 'move') {
      const origX = ia.origX;
      const origY = ia.origY;
      setRegions((prev) =>
        prev.map((r) =>
          r.id !== id
            ? r
            : {
                ...r,
                x: Math.max(0, Math.min(EDITOR_IMG_W - r.width, origX + dx)),
                y: Math.max(0, origY + dy),
              },
        ),
      );
    } else {
      const origW = ia.origW;
      const origH = ia.origH;
      setRegions((prev) =>
        prev.map((r) =>
          r.id !== id
            ? r
            : {
                ...r,
                width:  Math.max(30, Math.min(EDITOR_IMG_W - r.x, origW + dx)),
                height: Math.max(30, origH + dy),
              },
        ),
      );
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    interaction.current = { type: 'none' };
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  /** 선택된 영역 안에 모자이크를 적용한 canvas를 생성 후 dataURL 반환 */
  const buildCanvas = (): HTMLCanvasElement | null => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return null;

    const scaleX = img.naturalWidth  / EDITOR_IMG_W;
    // 표시 높이 = EDITOR_IMG_W * (naturalHeight / naturalWidth)
    const displayH = EDITOR_IMG_W * (img.naturalHeight / img.naturalWidth);
    const scaleY = img.naturalHeight / displayH;

    const canvas = document.createElement('canvas');
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;

    // 원본 이미지 전체를 그린다
    ctx.drawImage(img, 0, 0);

    // 각 블러 박스에 픽셀레이션 적용
    for (const r of regions) {
      const nx = Math.round(r.x      * scaleX);
      const ny = Math.round(r.y      * scaleY);
      const nw = Math.max(1, Math.round(r.width  * scaleX));
      const nh = Math.max(1, Math.round(r.height * scaleY));

      // 소형 캔버스로 축소 → 확대 (nearest-neighbor) = 픽셀 모자이크
      const PIXEL_BLOCK = 18;
      const tw = Math.max(1, Math.ceil(nw / PIXEL_BLOCK));
      const th = Math.max(1, Math.ceil(nh / PIXEL_BLOCK));
      const tmp    = document.createElement('canvas');
      tmp.width    = tw;
      tmp.height   = th;
      const tctx   = tmp.getContext('2d')!;
      tctx.drawImage(img, nx, ny, nw, nh, 0, 0, tw, th);

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, tw, th, nx, ny, nw, nh);
      ctx.imageSmoothingEnabled = true;
    }

    return canvas;
  };

  /** "미리보기 생성" 버튼 */
  const generatePreview = () => {
    setGenerating(true);
    // rAF로 렌더 후 실행 (버튼 disabled 반영)
    requestAnimationFrame(() => {
      try {
        const canvas = buildCanvas();
        if (!canvas) { setGenerating(false); return; }
        const url = canvas.toDataURL('image/jpeg', 0.92);
        setPreviewUrl(url);
      } catch (err) {
        alert(`미리보기 생성 실패: ${(err as Error).message}\n(CORS 문제일 수 있습니다)`);
      } finally {
        setGenerating(false);
      }
    });
  };

  /** "이 결과로 승인" 버튼 — previewUrl(dataURL) → File */
  const handleApprove = () => {
    if (!previewUrl) return;
    setApproving(true);
    fetch(previewUrl)
      .then((r) => r.blob())
      .then((blob) => {
        const file = new File([blob], 'manual-blur.jpg', { type: 'image/jpeg' });
        onApprove(file, previewUrl);
      })
      .catch((err) => {
        alert(`승인 처리 실패: ${(err as Error).message}`);
        setApproving(false);
      });
  };

  const addRegion = () => {
    const id = nextId.current++;
    setRegions((prev) => [...prev, { id, x: 50, y: 50, width: 120, height: 120 }]);
    setSelectedId(id);
    setPreviewUrl(null); // 박스 변경 시 미리보기 초기화
  };

  const removeSelected = () => {
    if (selectedId === null) return;
    setRegions((prev) => prev.filter((r) => r.id !== selectedId));
    setSelectedId(null);
    setPreviewUrl(null);
  };

  return (
    <Modal wide>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: '#2d3748', margin: '0 0 6px' }}>
          🖌️ 수동 블러 편집기
        </h3>
        <p style={{ fontSize: 12, color: '#718096', margin: 0, lineHeight: 1.6 }}>
          원본 이미지 위에서 <strong>박스를 드래그</strong>하여 위치를 조정하고, 우측 하단 핸들로
          <strong>크기를 조절</strong>하세요. 설정 후 <strong>미리보기 생성</strong> → 확인 후 <strong>승인</strong>하면
          게시글 작성 단계로 넘어갑니다.
        </p>
      </div>

      {/* 툴바 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button style={C.btn('#4299e1')} onClick={addRegion}>
          ＋ 박스 추가
        </button>
        <button
          style={{ ...C.btn('#e53e3e'), opacity: selectedId === null ? 0.4 : 1, cursor: selectedId === null ? 'not-allowed' : 'pointer' }}
          onClick={removeSelected}
          disabled={selectedId === null}
        >
          🗑 선택 박스 삭제
        </button>
        <button
          style={{ ...C.btn('#805ad5'), opacity: (regions.length === 0 || generating) ? 0.4 : 1 }}
          onClick={generatePreview}
          disabled={regions.length === 0 || generating || !imgLoaded}
        >
          {generating ? '⏳ 생성 중...' : '👁 미리보기 생성'}
        </button>
      </div>

      {/* 이미지 에디터 영역 */}
      {!blobUrl && (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0', fontSize: 13 }}>
          ⏳ 이미지 로딩 중...
        </div>
      )}
      {blobUrl && (
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: EDITOR_IMG_W,
            maxWidth: '100%',
            userSelect: 'none',
            border: '2px solid #e2e8f0',
            borderRadius: 8,
            overflow: 'hidden',
            cursor: 'default',
            background: '#f7fafc',
          }}
        >
          {/* 원본 이미지 */}
          <img
            ref={imgRef}
            src={blobUrl}
            alt="원본 (편집용)"
            onLoad={() => setImgLoaded(true)}
            style={{ display: 'block', width: '100%', height: 'auto' }}
          />

          {/* 블러 박스 오버레이 */}
          {imgLoaded &&
            regions.map((r) => {
              const isSelected = selectedId === r.id;
              return (
                <div
                  key={r.id}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setSelectedId(r.id);
                    setPreviewUrl(null);
                    interaction.current = {
                      type: 'move',
                      id: r.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: r.x,
                      origY: r.y,
                    };
                  }}
                  style={{
                    position: 'absolute',
                    left: r.x,
                    top: r.y,
                    width: r.width,
                    height: r.height,
                    border: `2px solid ${isSelected ? '#3182ce' : '#d69e2e'}`,
                    background: isSelected ? 'rgba(49,130,206,0.12)' : 'rgba(214,158,46,0.12)',
                    cursor: 'move',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* 박스 번호 레이블 */}
                  <div style={{
                    position: 'absolute', top: 3, left: 5,
                    fontSize: 10, fontWeight: 800,
                    color: isSelected ? '#3182ce' : '#d69e2e',
                    pointerEvents: 'none',
                    lineHeight: 1,
                  }}>
                    {r.id}
                  </div>

                  {/* 리사이즈 핸들 (우측 하단) */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setSelectedId(r.id);
                      setPreviewUrl(null);
                      interaction.current = {
                        type: 'resize',
                        id: r.id,
                        startX: e.clientX,
                        startY: e.clientY,
                        origW: r.width,
                        origH: r.height,
                      };
                    }}
                    style={{
                      position: 'absolute',
                      right: -5,
                      bottom: -5,
                      width: 14,
                      height: 14,
                      background: isSelected ? '#3182ce' : '#d69e2e',
                      borderRadius: 3,
                      cursor: 'se-resize',
                      border: '2px solid #fff',
                    }}
                  />
                </div>
              );
            })}
        </div>
      )}

      {/* 박스 없음 경고 */}
      {imgLoaded && regions.length === 0 && (
        <div style={{ ...C.info('yellow'), marginTop: 10 }}>
          ⚠️ 박스가 없습니다. <strong>＋ 박스 추가</strong>를 눌러 블러 영역을 추가하세요.
        </div>
      )}

      {/* 미리보기 결과 */}
      {previewUrl && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#276749', marginBottom: 8 }}>
            ✅ 모자이크 미리보기 — 얼굴이 정상적으로 처리되었는지 확인하세요
          </div>
          <img
            src={previewUrl}
            alt="모자이크 미리보기"
            style={{
              width: '100%', maxWidth: EDITOR_IMG_W, display: 'block',
              borderRadius: 8, border: '2px solid #68d391', objectFit: 'contain',
            }}
          />
          <div style={{ ...C.info('green'), marginTop: 8 }}>
            👆 모자이크가 얼굴을 충분히 가리는지 확인 후 <strong>이 결과로 승인</strong>을 눌러주세요.
            다시 편집하려면 박스를 조정하고 <strong>미리보기 생성</strong>을 다시 클릭하세요.
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
        <button
          onClick={handleApprove}
          disabled={!previewUrl || approving}
          style={{
            ...C.btn('#38a169'),
            width: '100%', padding: '12px 0', fontSize: 14,
            opacity: (!previewUrl || approving) ? 0.4 : 1,
            cursor: (!previewUrl || approving) ? 'not-allowed' : 'pointer',
          }}
        >
          {approving ? '⏳ 처리 중...' : '✅ 이 결과로 승인 → 게시글 작성 단계로'}
        </button>
        <button
          onClick={onCancel}
          style={{ ...C.btn('#a0aec0'), width: '100%', padding: '10px 0', fontSize: 13 }}
        >
          ← 뒤로 (블러 확인 화면으로)
        </button>
      </div>
    </Modal>
  );
}

// ── 게시글 작성 섹션 ──────────────────────────────────────────────────────────
function S_PostUpload() {
  const [step, setStep]               = useState<PostFlowStep>('idle');
  const [uploadedImg, setUploadedImg] = useState<UploadedImg | null>(null);
  const [blurChoice, setBlurChoice]   = useState<BlurChoice | null>(null);
  // 수동 블러 결과 (ManualBlurEditor에서 생성)
  const [manualFile, setManualFile]         = useState<File | null>(null);
  const [manualPreview, setManualPreview]   = useState<string | null>(null);
  // 게시글 작성 후 서버에서 반환된 수동 블러 결과
  const [manualResult, setManualResult]     = useState<UploadedImg | null>(null);
  const [createdPostId, setCreatedPostId]   = useState<number | null>(null);
  const [content, setContent]   = useState('');
  const [keywordIds, setKeywordIds] = useState('');
  const [loading, setLoading]   = useState(false);
  const [res, setRes]           = useState('');
  const imgRef = useRef<HTMLInputElement>(null);

  // 처음부터 리셋
  const reset = () => {
    setStep('idle'); setUploadedImg(null); setBlurChoice(null);
    setManualFile(null); setManualPreview(null); setManualResult(null);
    setCreatedPostId(null); setContent(''); setKeywordIds(''); setRes('');
    if (imgRef.current) imgRef.current.value = '';
  };

  // ── Step 1: 이미지 업로드 ────────────────────────────────────────────────
  const handleUpload = async () => {
    const f = imgRef.current?.files?.[0];
    if (!f) { setRes('[Error] 파일을 선택하세요'); return; }
    setLoading(true); setRes('');
    try {
      const fd = new FormData();
      fd.append('file', f);
      const d = await apiForm<UploadedImg>('POST', '/uploads/post-image', fd);
      setUploadedImg(d);
      setRes(fmt(d));
      // 성공/실패 무관하게 항상 블러 확인 모달
      setStep('blur_decision');
    } catch (e: unknown) {
      setRes(`[Error] ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2-a: 자동 블러 승인 ─────────────────────────────────────────────
  const approveAuto = () => {
    setBlurChoice('auto');
    setStep('creating');
  };

  // ── Step 2-b: 수동 블러 편집기 열기 ─────────────────────────────────────
  const goManualEditor = () => setStep('manual_editor');

  // ── ManualBlurEditor 승인 콜백 ───────────────────────────────────────────
  const onManualApprove = (file: File, previewDataUrl: string) => {
    setManualFile(file);
    setManualPreview(previewDataUrl);
    setBlurChoice('manual');
    setStep('creating');
  };

  // ── Step 3: 게시글 작성 + 수동 블러 즉시 반영 ────────────────────────────
  const handleCreatePost = async () => {
    if (!uploadedImg) { setRes('[Error] 이미지 정보가 없습니다'); return; }
    if (!content.trim()) { setRes('[Error] content를 입력하세요'); return; }
    if (blurChoice === 'manual' && !manualFile) {
      setRes('[Error] 수동 블러 파일이 없습니다. 편집기에서 승인하세요');
      return;
    }
    setLoading(true); setRes('');
    try {
      // POST /posts
      const body: Record<string, unknown> = {
        content: content.trim(),
        image: uploadedImg,
      };
      if (keywordIds.trim())
        body.keywordIds = keywordIds.split(',').map((s) => Number(s.trim())).filter(Boolean);

      const post = await api<{ postId: number }>('POST', '/posts', body);
      setCreatedPostId(post.postId);

      // 수동 블러라면 즉시 API 적용
      if (blurChoice === 'manual' && manualFile) {
        const fd = new FormData();
        fd.append('file', manualFile);
        const blurRes = await apiForm<UploadedImg>(
          'PATCH',
          `/uploads/posts/${post.postId}/manual-blur`,
          fd,
        );
        setManualResult(blurRes);
        setRes(fmt({ post, manualBlur: blurRes }));
      } else {
        setRes(fmt(post));
      }
      setStep('done');
    } catch (e: unknown) {
      setRes(`[Error] ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── 스텝 인디케이터 ──────────────────────────────────────────────────────
  const STEP_LABELS = ['이미지 업로드', '블러 확인/편집', '게시글 작성', '완료'];
  const stepIdx = (
    { idle: 0, blur_decision: 1, manual_editor: 1, creating: 2, done: 3 } as Record<PostFlowStep, number>
  )[step];

  return (
    <>
      {/* 스텝 인디케이터 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 20 }}>
        {STEP_LABELS.map((label, i) => (
          <div
            key={i}
            style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABELS.length - 1 ? 1 : 'none' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i === stepIdx ? '#6b46c1' : i < stepIdx ? '#38a169' : '#e2e8f0',
                color: i <= stepIdx ? '#fff' : '#a0aec0',
              }}>
                {i < stepIdx ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: 10, whiteSpace: 'nowrap',
                color: i === stepIdx ? '#6b46c1' : i < stepIdx ? '#38a169' : '#a0aec0',
                fontWeight: i === stepIdx ? 700 : 400,
              }}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div style={{
                flex: 1, height: 2,
                background: i < stepIdx ? '#38a169' : '#e2e8f0',
                margin: '0 6px', marginBottom: 14,
              }} />
            )}
          </div>
        ))}
        <button
          onClick={reset}
          style={{ ...C.btn('#718096'), marginLeft: 12, fontSize: 11, padding: '4px 10px', marginTop: 0, marginBottom: 14 }}
        >
          처음부터
        </button>
      </div>

      {/* ── STEP 1: 이미지 업로드 ── */}
      {step === 'idle' && (
        <div style={C.card}>
          <h3 style={C.h3}>📸 Step 1 — 이미지 업로드</h3>
          <div style={C.info('blue')}>
            업로드하면 서버에서 AI 자동 블러를 시도합니다.{' '}
            <strong>성공 여부에 관계없이 항상 블러 결과 확인 모달</strong>이 표시됩니다.
          </div>
          <div style={{ marginBottom: 10 }}>
            <span style={C.label}>이미지 파일 선택</span>
            <input ref={imgRef} type="file" accept="image/*" style={{ fontSize: 13 }} />
          </div>
          <button style={C.btn('#6b46c1')} onClick={handleUpload} disabled={loading}>
            {loading ? '⏳ 업로드 중 (AI 블러 처리)...' : 'POST /uploads/post-image'}
          </button>
          <Result data={res} />
        </div>
      )}

      {/* ── MODAL: 블러 확인 (blur_decision) ── */}
      {step === 'blur_decision' && uploadedImg && (
        <Modal>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 36 }}>
              {uploadedImg.aiBlurStatus === 'FAILED' ? '⚠️' : '🔍'}
            </div>
            <h3 style={{
              fontSize: 17, fontWeight: 800, margin: '8px 0 4px',
              color: uploadedImg.aiBlurStatus === 'FAILED' ? '#c53030' : '#2d3748',
            }}>
              블러 처리 결과 확인
            </h3>
            <div style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 20,
              fontSize: 12, fontWeight: 700, marginTop: 4,
              background: uploadedImg.aiBlurStatus === 'FAILED' ? '#fff5f5' : '#f0fff4',
              color:      uploadedImg.aiBlurStatus === 'FAILED' ? '#c53030' : '#276749',
              border: `1px solid ${uploadedImg.aiBlurStatus === 'FAILED' ? '#fc8181' : '#68d391'}`,
            }}>
              AI: {uploadedImg.aiBlurStatus} &nbsp;·&nbsp; blurMethod: {uploadedImg.blurMethod}
            </div>
          </div>

          {/* 원본 / AI 결과 이미지 비교 */}
          <ImgCompare img={uploadedImg} />

          {uploadedImg.aiBlurStatus === 'FAILED' && (
            <div style={C.info('red')}>
              AI 블러가 실패했습니다. 처리되지 않은 원본 이미지 상태입니다.<br />
              <strong>수동 블러 편집기</strong>에서 직접 모자이크 영역을 지정해 주세요.
            </div>
          )}
          {uploadedImg.aiBlurStatus !== 'FAILED' && (
            <div style={C.info('blue')}>
              AI 블러가 적용된 이미지를 확인하세요. 얼굴이 충분히 가려졌다면{' '}
              <strong>자동 블러 승인</strong>을, 직접 조정하려면 <strong>수동 블러</strong>를 선택하세요.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {/* AI 성공 시에만 자동 승인 활성 */}
            <button
              onClick={approveAuto}
              disabled={uploadedImg.aiBlurStatus === 'FAILED'}
              style={{
                ...C.btn('#38a169'), width: '100%', padding: '12px 0', fontSize: 13,
                opacity: uploadedImg.aiBlurStatus === 'FAILED' ? 0.35 : 1,
                cursor:  uploadedImg.aiBlurStatus === 'FAILED' ? 'not-allowed' : 'pointer',
              }}
            >
              ✅ 자동 블러 처리 승인 → 게시글 작성
            </button>
            <button
              onClick={goManualEditor}
              style={{ ...C.btn('#d69e2e'), width: '100%', padding: '12px 0', fontSize: 13 }}
            >
              🔵 수동 블러 처리 → 직접 모자이크 영역 지정
            </button>
            <button
              onClick={reset}
              style={{ ...C.btn('#a0aec0'), width: '100%', padding: '10px 0', fontSize: 12 }}
            >
              취소 (다시 업로드)
            </button>
          </div>
        </Modal>
      )}

      {/* ── MODAL: 수동 블러 캔버스 편집기 (manual_editor) ── */}
      {step === 'manual_editor' && uploadedImg && (
        <ManualBlurEditor
          originalImageUrl={
            // 원본 이미지 URL (ASSET prefix 포함)
            uploadedImg.originalImageUrl.startsWith('/')
              ? `${ASSET}${uploadedImg.originalImageUrl}`
              : uploadedImg.originalImageUrl
          }
          onApprove={onManualApprove}
          onCancel={() => setStep('blur_decision')}
        />
      )}

      {/* ── STEP 3: 게시글 작성 ── */}
      {step === 'creating' && uploadedImg && (
        <div style={C.card}>
          <h3 style={C.h3}>📝 Step 3 — 게시글 작성</h3>

          {/* 블러 선택 결과 배지 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8,
            marginBottom: 14, border: '1px solid',
            background: blurChoice === 'auto' ? '#f0fff4' : '#fffbeb',
            borderColor: blurChoice === 'auto' ? '#9ae6b4' : '#f6e05e',
          }}>
            <span style={{ fontSize: 20 }}>{blurChoice === 'auto' ? '✅' : '🔵'}</span>
            <div style={{ flex: 1, fontSize: 12 }}>
              <div style={{ fontWeight: 700 }}>
                {blurChoice === 'auto' ? 'AI 자동 블러 승인됨' : '수동 블러 편집 완료 · 승인됨'}
              </div>
              <div style={{ color: '#718096', marginTop: 2 }}>
                {blurChoice === 'auto'
                  ? `aiBlurStatus: ${uploadedImg.aiBlurStatus} · blurMethod: ${uploadedImg.blurMethod}`
                  : `캔버스 편집 결과 File 준비됨 — 게시글 작성 후 즉시 PATCH /uploads/posts/:id/manual-blur 호출`}
              </div>
            </div>
            {/* 수동 블러 미리보기 썸네일 */}
            {blurChoice === 'manual' && manualPreview && (
              <img
                src={manualPreview}
                alt="수동블러 미리보기"
                style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '2px solid #d69e2e', flexShrink: 0 }}
              />
            )}
          </div>

          <Field
            label="본문 content (필수, 최대 500자)"
            value={content}
            onChange={setContent}
            placeholder="봄 코디 평가 부탁드립니다!"
          />
          <Field
            label="키워드 ID 목록 (쉼표 구분, 선택 — 예: 1,3)"
            value={keywordIds}
            onChange={setKeywordIds}
            placeholder="1,3"
          />
          <div style={{ marginBottom: 12, padding: '8px 10px', background: '#f7fafc', borderRadius: 6, fontSize: 11, color: '#718096', fontFamily: 'monospace' }}>
            outfitItems 예시: [{'"category":"TOP","itemName":"화이트셔츠","brand":"SPAO"'}]
          </div>

          <button style={C.btn('#6b46c1')} onClick={handleCreatePost} disabled={loading}>
            {loading
              ? blurChoice === 'manual'
                ? '⏳ 게시글 작성 + 수동 블러 적용 중...'
                : '⏳ 게시글 작성 중...'
              : 'POST /posts' + (blurChoice === 'manual' ? ' + PATCH /uploads/posts/:id/manual-blur' : '')}
          </button>
          <Result data={res} />
        </div>
      )}

      {/* ── STEP 4: 완료 ── */}
      {step === 'done' && (
        <>
          <div style={{ ...C.info('green'), display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 28 }}>🎉</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>게시글 작성 완료!</div>
              <div style={{ fontSize: 12, color: '#276749', marginTop: 2 }}>
                postId: <strong>{createdPostId}</strong> &nbsp;·&nbsp;
                블러: <strong>{blurChoice === 'auto' ? 'AI 자동 (AUTO)' : '수동 (MANUAL)'}</strong>
              </div>
            </div>
          </div>

          {/* 최종 이미지 결과 비교 */}
          {uploadedImg && (
            <div style={C.card}>
              <h3 style={{ ...C.h3, marginBottom: 10 }}>📷 최종 이미지 결과</h3>
              {blurChoice === 'auto' ? (
                // 자동 승인: 원본 + AI 결과
                <ImgCompare img={uploadedImg} />
              ) : (
                // 수동 승인: 원본 + AI 결과 + 수동 블러 결과
                <ImgCompare
                  img={uploadedImg}
                  manualPreview={
                    manualResult
                      ? assetUrl(manualResult.processedImageUrl)
                      : manualPreview
                  }
                />
              )}
              {blurChoice === 'manual' && manualResult && (
                <div style={C.info('green')}>
                  ✅ 수동 블러 서버 반영 완료 — blurMethod: <strong>MANUAL</strong> &nbsp;/&nbsp;
                  aiBlurStatus: <strong>{uploadedImg.aiBlurStatus}</strong> (보존됨)
                </div>
              )}
              {blurChoice === 'manual' && !manualResult && (
                <div style={C.info('yellow')}>
                  ⚠️ 수동 블러 API 응답이 없습니다. 서버 응답을 확인하세요.
                </div>
              )}
            </div>
          )}

          <button style={C.btn('#718096')} onClick={reset}>
            처음부터 (새 게시글 작성)
          </button>
          <Result data={res} />
        </>
      )}
    </>
  );
}

// ─── SECTION 8-B: 신고 ────────────────────────────────────────────────────────

function S_Reports() {
  const [tab, setTab]           = useState<'post' | 'user'>('post');
  const [targetId, setTargetId] = useState('');
  const [title, setTitle]       = useState('');
  const [reason, setReason]     = useState('SPAM');
  const [desc, setDesc]         = useState('');
  const [res, setRes]           = useState('');

  const reasonOpts = [
    { value: 'SPAM',          label: 'SPAM — 스팸/도배' },
    { value: 'ABUSE',         label: 'ABUSE — 욕설/비하' },
    { value: 'INAPPROPRIATE', label: 'INAPPROPRIATE — 부적절한 내용' },
    { value: 'ETC',           label: 'ETC — 기타' },
  ];

  const submit = () => {
    if (!targetId.trim()) {
      setRes(`[Error] ${tab === 'post' ? '게시글' : '사용자'} ID를 입력하세요`);
      return;
    }
    if (!title.trim()) { setRes('[Error] 신고 제목을 입력하세요'); return; }
    const path = tab === 'post' ? `/posts/${targetId}/reports` : `/users/${targetId}/reports`;
    const body: Record<string, unknown> = { title: title.trim(), reason };
    if (desc.trim()) body.description = desc.trim();
    run(() => api('POST', path, body), setRes);
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button onClick={() => { setTab('post'); setRes(''); }} style={C.tab(tab === 'post', '#e53e3e')}>
          🗒️ 게시글 신고
        </button>
        <button onClick={() => { setTab('user'); setRes(''); }} style={C.tab(tab === 'user', '#e53e3e')}>
          👤 사용자 신고
        </button>
      </div>

      <div style={C.card}>
        <h3 style={C.h3}>{tab === 'post' ? '🗒️ 게시글 신고' : '👤 사용자 신고'}</h3>
        {tab === 'post' ? (
          <div style={C.info('blue')}>
            동일 사용자가 동일 게시글에 대해 신고는 <strong>1회만</strong> 가능합니다.
          </div>
        ) : (
          <div style={C.info('blue')}>
            동일 대상 사용자에 대해 <strong>PENDING 상태 신고가 이미 존재하면</strong> 중복 신고가 거부됩니다.
          </div>
        )}

        <Field
          label={tab === 'post' ? '신고할 게시글 ID (postId)' : '신고할 사용자 ID (userId)'}
          value={targetId}
          onChange={setTargetId}
          placeholder={tab === 'post' ? 'ex) 12' : 'ex) 7'}
        />
        <Field
          label="신고 제목 (최대 100자)"
          value={title}
          onChange={setTitle}
          placeholder="스팸 게시글입니다"
        />
        <SelectField label="신고 사유" value={reason} onChange={setReason} options={reasonOpts} />
        <div style={{ marginBottom: 8 }}>
          <span style={C.label}>상세 설명 (선택, 최대 500자)</span>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="신고 사유를 상세히 작성해 주세요"
            style={{ ...C.input, height: 64, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
        <button style={C.btn('#e53e3e')} onClick={submit}>
          {tab === 'post' ? 'POST /posts/:postId/reports' : 'POST /users/:userId/reports'}
        </button>
        <Result data={res} />
      </div>

      <div style={{ ...C.info('yellow'), fontSize: 11 }}>
        💡 신고 목록 조회 및 처리는 <strong>🛡️ 관리자</strong> 섹션에서 확인하세요.
        (GET /admin/post-reports, GET /admin/user-reports)
      </div>
    </>
  );
}

// ─── SECTION 9: 평가존 ────────────────────────────────────────────────────────

function S_Evaluation() {
  const [tab, setTab]                   = useState<'list' | 'detail' | 'vote'>('list');
  const [postId, setPostId]             = useState('');
  const [choice, setChoice]             = useState<'LIKE' | 'DISLIKE'>('LIKE');
  const [voteId, setVoteId]             = useState('');
  const [tags, setTags]                 = useState<{ id: number; label: string; code: string }[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<number>>(new Set());
  const [res, setRes]                   = useState('');

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
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setRes(''); }}
            style={C.tab(tab === t.key, '#b7791f')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <div style={C.card}>
          <h3 style={C.h3}>📋 평가존 목록</h3>
          <div style={C.info('blue')}>
            본인 게시글 제외 + 이미 투표한 게시글 제외. OPEN 상태 게시글만 반환됩니다.
          </div>
          <button
            style={C.btn('#b7791f')}
            onClick={() => run(() => api('GET', '/evaluations'), setRes)}
          >
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
          <button
            style={C.btn('#b7791f')}
            onClick={() => run(() => api('GET', `/evaluations/posts/${postId}`), setRes)}
          >
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
            <Field
              label="게시글 ID (postId)"
              value={postId}
              onChange={setPostId}
              placeholder="투표할 게시글 ID"
            />
            <div style={{ marginBottom: 10 }}>
              <span style={C.label}>투표 선택</span>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['LIKE', 'DISLIKE'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setChoice(c)}
                    style={{
                      padding: '8px 24px', borderRadius: 8, border: '2px solid',
                      cursor: 'pointer', fontSize: 14, fontWeight: 700,
                      background: choice === c ? (c === 'LIKE' ? '#38a169' : '#e53e3e') : '#fff',
                      color: choice === c ? '#fff' : (c === 'LIKE' ? '#38a169' : '#e53e3e'),
                      borderColor: c === 'LIKE' ? '#38a169' : '#e53e3e',
                    }}
                  >
                    {c === 'LIKE' ? '👍 좋아요' : '👎 싫어요'}
                  </button>
                ))}
              </div>
            </div>
            <button
              style={C.btn(choice === 'LIKE' ? '#38a169' : '#e53e3e')}
              onClick={() =>
                run(async () => {
                  const d = await api<{ voteId: number }>(
                    'POST',
                    `/evaluations/posts/${postId}/votes`,
                    { choice },
                  );
                  setVoteId(String(d.voteId));
                  setSelectedTags(new Set());
                  setTags([]);
                  return d;
                }, setRes)
              }
            >
              POST /evaluations/posts/:postId/votes
            </button>
            <Result data={res} />
          </div>

          <div style={C.card}>
            <h3 style={C.h3}>🏷️ 피드백 태그 선택 (최대 3개 — V2 정책)</h3>
            <div style={C.info('yellow')}>
              ⚠️ 피드백 태그는 <strong>투표 직후 1회만</strong> 제출 가능합니다. 이후 수정/삭제 불가.
              최대 <strong>3개</strong>까지 선택할 수 있습니다.
            </div>
            <Field
              label="voteId (투표 후 자동 입력됨)"
              value={voteId}
              onChange={setVoteId}
              placeholder="투표 후 자동 입력"
            />
            <button
              style={C.btn('#718096')}
              onClick={() => {
                run(async () => {
                  const d = await api<{ items: { id: number; label: string; code: string }[] }>(
                    'GET',
                    `/evaluations/tags?voteChoice=${choice}`,
                  );
                  setTags(d.items);
                  return d;
                }, setRes);
              }}
            >
              태그 목록 불러오기 (voteChoice: {choice})
            </button>

            {tags.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, marginBottom: 8 }}>
                  선택됨:{' '}
                  <strong style={{ color: selectedTags.size === 3 ? '#e53e3e' : '#2b6cb0' }}>
                    {selectedTags.size} / 3
                  </strong>
                  {selectedTags.size === 3 && (
                    <span style={{ color: '#e53e3e', marginLeft: 6 }}>최대 선택!</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {tags.map((tag) => {
                    const sel      = selectedTags.has(tag.id);
                    const disabled = !sel && selectedTags.size >= 3;
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        style={{
                          padding: '6px 14px', borderRadius: 20, border: '2px solid',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          fontSize: 12, fontWeight: sel ? 700 : 400,
                          background: sel ? '#b7791f' : '#fff',
                          color: sel ? '#fff' : disabled ? '#a0aec0' : '#4a5568',
                          borderColor: sel ? '#b7791f' : disabled ? '#e2e8f0' : '#cbd5e0',
                          opacity: disabled ? 0.5 : 1,
                        }}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  style={{ ...C.btn('#b7791f'), marginTop: 12 }}
                  onClick={() => {
                    if (!voteId) { setRes('[Error] voteId가 없습니다. 먼저 투표하세요'); return; }
                    if (selectedTags.size === 0) { setRes('[Error] 태그를 1개 이상 선택하세요'); return; }
                    run(
                      () =>
                        api('POST', `/evaluations/votes/${voteId}/feedback`, {
                          tagIds: Array.from(selectedTags),
                        }),
                      setRes,
                    );
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
  { key: 'reports',    label: '🚨 신고',              component: S_Reports },
];

export default function TestPage() {
  const [active, setActive] = useState('login');
  const ActiveSection = SECTIONS.find((sec) => sec.key === active)?.component ?? S_Login;

  return (
    <div style={{
      display: 'flex', height: '100vh',
      fontFamily: "'Pretendard', 'Inter', -apple-system, sans-serif",
      background: '#f7fafc',
    }}>
      {/* 사이드바 */}
      <aside style={{
        width: 210, background: '#1a202c', display: 'flex',
        flexDirection: 'column', flexShrink: 0, overflowY: 'auto',
      }}>
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid #2d3748' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            C:dinator V2
          </div>
          <div style={{ fontSize: 11, color: '#4a5568', marginTop: 3 }}>API Test Panel</div>
        </div>

        <nav style={{ padding: '8px 0', flex: 1 }}>
          {SECTIONS.map((sec) => (
            <button
              key={sec.key}
              onClick={() => setActive(sec.key)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 16px',
                background: active === sec.key ? '#2d3748' : 'transparent',
                border: 'none',
                borderLeft: `3px solid ${active === sec.key ? '#63b3ed' : 'transparent'}`,
                color: active === sec.key ? '#fff' : '#718096',
                fontSize: 13, cursor: 'pointer',
                fontWeight: active === sec.key ? 700 : 400,
                transition: 'all 0.1s',
              }}
            >
              {sec.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '10px 16px', borderTop: '1px solid #2d3748', fontSize: 11 }}>
          {tok() ? (
            <span style={{ color: '#68d391' }}>
              ✅ uid: {localStorage.getItem('userId')} / {localStorage.getItem('nickname')}
            </span>
          ) : (
            <span style={{ color: '#fc8181' }}>⚠️ 로그인 필요</span>
          )}
        </div>
      </aside>

      {/* 콘텐츠 */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <div style={{ maxWidth: 740 }}>
          <ActiveSection />
        </div>
      </main>
    </div>
  );
}