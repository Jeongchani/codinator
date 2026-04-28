/**
 * C:dinator V3 관리자 페이지
 *
 * 이 파일은 기존 TestPage.tsx를 대체한다.
 * 라우트는 /admin 이며 RequireAdminRoute에서 SUPER_ADMIN / OPERATOR_ADMIN만 통과시킨다.
 */

import { useState } from 'react';
import { getAccessToken, performApiRequest } from './lib/api';

// ─── API 헬퍼 ─────────────────────────────────────────────────────────────────

const tok = () => getAccessToken() ?? '';

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await performApiRequest(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    const raw = data as Record<string, unknown> | null;
    const msg =
      raw && typeof raw === 'object' && 'message' in raw
        ? Array.isArray(raw.message)
          ? (raw.message as string[]).join(', ')
          : String(raw.message)
        : text;
    throw new Error(`[${res.status}] ${msg}`);
  }

  return data as T;
}

const fmt = (v: unknown) => JSON.stringify(v, null, 2);

function run<T>(fn: () => Promise<T>, set: (s: string) => void) {
  fn()
    .then((d) => set(fmt(d)))
    .catch((e: Error) => set(`[Error] ${e.message}`));
}

function qs(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') q.set(key, value);
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ─── 공통 UI ─────────────────────────────────────────────────────────────────

const C = {
  card: {
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: 16,
    marginBottom: 14,
    background: '#fff',
  } as React.CSSProperties,
  label: {
    fontSize: 11,
    color: '#718096',
    display: 'block',
    marginBottom: 4,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #cbd5e0',
    borderRadius: 6,
    fontSize: 13,
    boxSizing: 'border-box' as const,
    outline: 'none',
    background: '#fff',
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
  h2: {
    fontSize: 18,
    fontWeight: 800,
    marginBottom: 12,
    color: '#1a202c',
  } as React.CSSProperties,
  h3: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 12,
    color: '#1a202c',
  } as React.CSSProperties,
  info: (color: 'blue' | 'yellow' | 'green' | 'red' = 'blue'): React.CSSProperties => {
    const map = {
      blue: { bg: '#ebf8ff', border: '#bee3f8', text: '#2b6cb0' },
      yellow: { bg: '#fffbeb', border: '#f6e05e', text: '#7c4a03' },
      green: { bg: '#f0fff4', border: '#9ae6b4', text: '#276749' },
      red: { bg: '#fff5f5', border: '#feb2b2', text: '#c53030' },
    }[color];
    return {
      padding: '8px 10px',
      background: map.bg,
      border: `1px solid ${map.border}`,
      color: map.text,
      borderRadius: 6,
      fontSize: 11,
      marginBottom: 10,
      lineHeight: 1.5,
    };
  },
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <span style={C.label}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          ...C.input,
          background: disabled ? '#f7fafc' : '#fff',
          color: disabled ? '#718096' : '#1a202c',
          cursor: disabled ? 'not-allowed' : 'text',
        }}
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <span style={C.label}>{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{ ...C.input, resize: 'vertical', fontFamily: 'inherit' }}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  width = 240,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  width?: number;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <span style={C.label}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...C.input, width }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Result({ data }: { data: string }) {
  if (!data) return null;
  const err = data.startsWith('[Error]');
  return (
    <pre
      style={{
        marginTop: 8,
        padding: 10,
        borderRadius: 6,
        fontSize: 11,
        overflow: 'auto',
        maxHeight: 280,
        background: err ? '#fff5f5' : '#f0fff4',
        border: `1px solid ${err ? '#fc8181' : '#68d391'}`,
        color: err ? '#c53030' : '#276749',
      }}
    >
      {data}
    </pre>
  );
}

function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div style={C.card}>
        <h2 style={C.h2}>{title}</h2>
        {description && <div style={C.info('blue')}>{description}</div>}
        <div style={C.info('yellow')}>
          관리자 페이지입니다. 버튼에는 URL을 노출하지 않고 기능명만 표시합니다.
        </div>
      </div>
      {children}
    </>
  );
}

// ─── 관리자 홈 ───────────────────────────────────────────────────────────────

type AdminPageKey =
  | 'admin-home'
  | 'admin-reports'
  | 'admin-operations'
  | 'admin-masters'
  | 'admin-sanctions'
  | 'admin-logs';

function S_AdminHome({ onMove }: { onMove: (page: AdminPageKey) => void }) {
  return (
    <PageShell
      title="🛠️ 관리자 테스트 홈"
      description="각 관리자 기능을 별도 페이지 성격의 화면으로 분리했다. 왼쪽 메뉴 또는 아래 바로가기 카드로 이동할 수 있다."
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
        {[
          {
            key: 'admin-reports' as const,
            title: '🚨 신고 관리',
            desc: '신고 목록 / 처리 / 재오픈',
          },
          {
            key: 'admin-operations' as const,
            title: '⚙️ 게시글·회원 운영',
            desc: '게시글 상태 / 회원 상태 / 목록 조회',
          },
          {
            key: 'admin-masters' as const,
            title: '📚 마스터 관리',
            desc: '키워드 / 피드백 태그 관리',
          },
          {
            key: 'admin-sanctions' as const,
            title: '🚫 제재 관리',
            desc: '제재 생성 / 종료 / 제한 제재 생성',
          },
          { key: 'admin-logs' as const, title: '📜 로그·이력', desc: '액션 로그 / 신고 이력 조회' },
        ].map((item) => (
          <div key={item.key} style={{ ...C.card, marginBottom: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#2d3748', marginBottom: 6 }}>
              {item.title}
            </div>
            <div style={{ fontSize: 12, color: '#718096', marginBottom: 12 }}>{item.desc}</div>
            <button style={C.btn('#553c9a')} onClick={() => onMove(item.key)}>
              페이지 열기
            </button>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

// ─── 신고 관리 ───────────────────────────────────────────────────────────────

function S_AdminReports() {
  const [res, setRes] = useState('');

  const [listType, setListType] = useState<'post' | 'user'>('post');
  const [listStatus, setListStatus] = useState('PENDING');

  const [reviewType, setReviewType] = useState<'post' | 'user'>('post');
  const [reviewReportId, setReviewReportId] = useState('');
  const [reviewAction, setReviewAction] = useState('RESOLVED');
  const [reviewReason, setReviewReason] = useState('');

  const [reopenType, setReopenType] = useState<'post' | 'user'>('post');
  const [reopenReportId, setReopenReportId] = useState('');
  const [reopenReason, setReopenReason] = useState('');

  return (
    <PageShell
      title="🚨 신고 관리"
      description="게시글 신고 / 사용자 신고 목록 조회, 처리, 재오픈을 각각 관리한다."
    >
      <div style={C.info('yellow')}>
        신고 처리 요청 body는 <strong>status</strong>가 아니라 <strong>action</strong> 기준이다.
      </div>

      <div style={C.card}>
        <h3 style={C.h3}>📋 신고 목록 조회</h3>
        <SelectField
          label="신고 유형"
          value={listType}
          onChange={(v) => setListType(v as 'post' | 'user')}
          options={[
            { value: 'post', label: '게시글 신고' },
            { value: 'user', label: '사용자 신고' },
          ]}
        />
        <SelectField
          label="상태 필터"
          value={listStatus}
          onChange={setListStatus}
          options={[
            { value: '', label: '전체' },
            { value: 'PENDING', label: 'PENDING — 미처리' },
            { value: 'RESOLVED', label: 'RESOLVED — 처리 완료' },
            { value: 'REJECTED', label: 'REJECTED — 반려' },
          ]}
        />
        <button
          style={C.btn('#553c9a')}
          onClick={() => {
            const path = listType === 'post' ? '/admin/post-reports' : '/admin/user-reports';
            run(() => api('GET', `${path}${qs({ status: listStatus })}`), setRes);
          }}
        >
          신고 목록 조회
        </button>
      </div>

      <div style={C.card}>
        <h3 style={C.h3}>✅ 신고 처리</h3>
        <SelectField
          label="신고 유형"
          value={reviewType}
          onChange={(v) => setReviewType(v as 'post' | 'user')}
          options={[
            { value: 'post', label: '게시글 신고' },
            { value: 'user', label: '사용자 신고' },
          ]}
        />
        <Field
          label="신고 ID (reportId)"
          value={reviewReportId}
          onChange={setReviewReportId}
          placeholder="ex) 3"
        />
        <SelectField
          label="처리 결과"
          value={reviewAction}
          onChange={setReviewAction}
          options={[
            { value: 'RESOLVED', label: 'RESOLVED — 신고 처리 완료' },
            { value: 'REJECTED', label: 'REJECTED — 신고 반려' },
          ]}
        />
        <TextAreaField
          label="처리 사유 (선택)"
          value={reviewReason}
          onChange={setReviewReason}
          placeholder="review_reason에 저장할 처리 사유"
        />
        <button
          style={C.btn('#e53e3e')}
          onClick={() => {
            const path =
              reviewType === 'post'
                ? `/admin/post-reports/${reviewReportId}`
                : `/admin/user-reports/${reviewReportId}`;
            const body: Record<string, unknown> = { action: reviewAction };
            if (reviewReason.trim()) body.reason = reviewReason.trim();
            run(() => api('PATCH', path, body), setRes);
          }}
        >
          신고 처리 적용
        </button>
      </div>

      <div style={C.card}>
        <h3 style={C.h3}>🔄 신고 재오픈</h3>
        <SelectField
          label="신고 유형"
          value={reopenType}
          onChange={(v) => setReopenType(v as 'post' | 'user')}
          options={[
            { value: 'post', label: '게시글 신고' },
            { value: 'user', label: '사용자 신고' },
          ]}
        />
        <Field
          label="신고 ID (reportId)"
          value={reopenReportId}
          onChange={setReopenReportId}
          placeholder="ex) 3"
        />
        <TextAreaField
          label="재오픈 사유 (선택)"
          value={reopenReason}
          onChange={setReopenReason}
          placeholder="추가 검토 필요"
        />
        <button
          style={C.btn('#ed8936')}
          onClick={() => {
            const path =
              reopenType === 'post'
                ? `/admin/post-reports/${reopenReportId}/reopen`
                : `/admin/user-reports/${reopenReportId}/reopen`;
            const body: Record<string, unknown> = {};
            if (reopenReason.trim()) body.reason = reopenReason.trim();
            run(() => api('PATCH', path, body), setRes);
          }}
        >
          신고 재오픈
        </button>
      </div>

      <Result data={res} />
    </PageShell>
  );
}

// ─── 게시글·회원 운영 ───────────────────────────────────────────────────────

function S_AdminOperations() {
  const [res, setRes] = useState('');

  const [postStatusFilter, setPostStatusFilter] = useState('');
  const [postCursor, setPostCursor] = useState('');
  const [postLimit, setPostLimit] = useState('20');
  const [postId, setPostId] = useState('');
  const [postStatus, setPostStatus] = useState('HIDDEN');
  const [hiddenReason, setHiddenReason] = useState('');

  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userCursor, setUserCursor] = useState('');
  const [userLimit, setUserLimit] = useState('20');
  const [userId, setUserId] = useState('');
  const [userStatus, setUserStatus] = useState('SUSPENDED');
  const [userReason, setUserReason] = useState('');

  return (
    <PageShell
      title="⚙️ 게시글·회원 운영"
      description="게시글 목록/상태 변경과 회원 목록/상태 변경을 분리해서 테스트한다."
    >
      <div style={C.info('yellow')}>
        회원 상태는 <strong>ACTIVE / SUSPENDED / DELETED</strong>만 사용한다.
      </div>

      <div style={C.card}>
        <h3 style={C.h3}>📋 게시글 목록 조회</h3>
        <SelectField
          label="게시글 상태 필터"
          value={postStatusFilter}
          onChange={setPostStatusFilter}
          options={[
            { value: '', label: '전체' },
            { value: 'ACTIVE', label: 'ACTIVE — 공개 중' },
            { value: 'HIDDEN', label: 'HIDDEN — 숨김' },
            { value: 'DELETED', label: 'DELETED — 삭제됨' },
          ]}
        />
        <Field
          label="cursor (선택)"
          value={postCursor}
          onChange={setPostCursor}
          placeholder="ex) 100"
        />
        <Field
          label="limit (선택, 기본 20)"
          value={postLimit}
          onChange={setPostLimit}
          placeholder="20"
        />
        <button
          style={C.btn('#553c9a')}
          onClick={() =>
            run(
              () =>
                api(
                  'GET',
                  `/admin/posts${qs({
                    status: postStatusFilter,
                    cursor: postCursor,
                    limit: postLimit,
                  })}`,
                ),
              setRes,
            )
          }
        >
          게시글 목록 조회
        </button>
      </div>

      <div style={C.card}>
        <h3 style={C.h3}>🔧 게시글 상태 변경</h3>
        <Field
          label="게시글 ID (postId)"
          value={postId}
          onChange={setPostId}
          placeholder="ex) 12"
        />
        <SelectField
          label="변경할 상태"
          value={postStatus}
          onChange={setPostStatus}
          options={[
            { value: 'ACTIVE', label: 'ACTIVE — 공개 복원' },
            { value: 'HIDDEN', label: 'HIDDEN — 관리자 숨김' },
            { value: 'DELETED', label: 'DELETED — 강제 삭제' },
          ]}
        />
        {postStatus === 'HIDDEN' && (
          <Field
            label="숨김 사유 (선택)"
            value={hiddenReason}
            onChange={setHiddenReason}
            placeholder="커뮤니티 가이드라인 위반"
          />
        )}
        <button
          style={C.btn(postStatus === 'DELETED' ? '#c53030' : '#553c9a')}
          onClick={() => {
            const body: Record<string, unknown> = { status: postStatus };
            if (postStatus === 'HIDDEN' && hiddenReason.trim())
              body.hiddenReason = hiddenReason.trim();
            run(() => api('PATCH', `/admin/posts/${postId}/status`, body), setRes);
          }}
        >
          게시글 상태 변경
        </button>
      </div>

      <div style={{ borderTop: '2px dashed #e2e8f0', margin: '8px 0 16px' }} />

      <div style={C.card}>
        <h3 style={C.h3}>👥 회원 목록 조회</h3>
        <SelectField
          label="회원 상태 필터"
          value={userStatusFilter}
          onChange={setUserStatusFilter}
          options={[
            { value: '', label: '전체' },
            { value: 'ACTIVE', label: 'ACTIVE — 정상' },
            { value: 'SUSPENDED', label: 'SUSPENDED — 정지' },
            { value: 'DELETED', label: 'DELETED — 삭제' },
          ]}
        />
        <SelectField
          label="역할 필터"
          value={userRoleFilter}
          onChange={setUserRoleFilter}
          options={[
            { value: '', label: '전체' },
            { value: 'USER', label: 'USER' },
            { value: 'SUPER_ADMIN', label: 'SUPER_ADMIN' },
            { value: 'OPERATOR_ADMIN', label: 'OPERATOR_ADMIN' },
          ]}
        />
        <Field
          label="cursor (선택)"
          value={userCursor}
          onChange={setUserCursor}
          placeholder="ex) 100"
        />
        <Field
          label="limit (선택, 기본 20)"
          value={userLimit}
          onChange={setUserLimit}
          placeholder="20"
        />
        <button
          style={C.btn('#553c9a')}
          onClick={() =>
            run(
              () =>
                api(
                  'GET',
                  `/admin/users${qs({
                    status: userStatusFilter,
                    role: userRoleFilter,
                    cursor: userCursor,
                    limit: userLimit,
                  })}`,
                ),
              setRes,
            )
          }
        >
          회원 목록 조회
        </button>
      </div>

      <div style={C.card}>
        <h3 style={C.h3}>🔧 회원 상태 변경</h3>
        <div style={C.info('red')}>
          <strong>DELETED</strong>는 SUPER_ADMIN 전용으로 해석한다.
        </div>
        <Field
          label="대상 사용자 ID (userId)"
          value={userId}
          onChange={setUserId}
          placeholder="ex) 7"
        />
        <SelectField
          label="변경할 상태"
          value={userStatus}
          onChange={setUserStatus}
          options={[
            { value: 'ACTIVE', label: 'ACTIVE — 정지 해제' },
            { value: 'SUSPENDED', label: 'SUSPENDED — 계정 정지' },
            { value: 'DELETED', label: 'DELETED — 강제 삭제' },
          ]}
        />
        <TextAreaField
          label="변경 사유 (선택)"
          value={userReason}
          onChange={setUserReason}
          placeholder="커뮤니티 가이드라인 위반"
        />
        <button
          style={C.btn(userStatus === 'DELETED' ? '#c53030' : '#553c9a')}
          onClick={() => {
            const body: Record<string, unknown> = { status: userStatus };
            if (userReason.trim()) body.reason = userReason.trim();
            run(() => api('PATCH', `/admin/users/${userId}/status`, body), setRes);
          }}
        >
          회원 상태 변경
        </button>
      </div>

      <Result data={res} />
    </PageShell>
  );
}

// ─── 마스터 관리 ─────────────────────────────────────────────────────────────

type CrudMode = 'CREATE' | 'UPDATE' | 'DELETE';
type BoolSelect = '' | 'true' | 'false';

function S_AdminMasters() {
  const [res, setRes] = useState('');

  const [keywordIsActiveFilter, setKeywordIsActiveFilter] = useState<BoolSelect>('');
  const [keywordMode, setKeywordMode] = useState<CrudMode>('CREATE');
  const [keywordId, setKeywordId] = useState('');
  const [keywordCode, setKeywordCode] = useState('');
  const [keywordLabel, setKeywordLabel] = useState('');
  const [keywordSortOrder, setKeywordSortOrder] = useState('0');
  const [keywordIsActive, setKeywordIsActive] = useState('true');

  const [tagVoteChoiceFilter, setTagVoteChoiceFilter] = useState('');
  const [tagGroupCodeFilter, setTagGroupCodeFilter] = useState('');
  const [tagIsActiveFilter, setTagIsActiveFilter] = useState<BoolSelect>('');
  const [tagMode, setTagMode] = useState<CrudMode>('CREATE');
  const [tagId, setTagId] = useState('');
  const [tagCode, setTagCode] = useState('');
  const [tagLabel, setTagLabel] = useState('');
  const [tagVoteChoice, setTagVoteChoice] = useState('LIKE');
  const [tagGroupCode, setTagGroupCode] = useState('');
  const [tagSortOrder, setTagSortOrder] = useState('0');
  const [tagIsActive, setTagIsActive] = useState('true');

  return (
    <PageShell
      title="📚 마스터 관리"
      description="키워드와 피드백 태그를 각각 하나의 관리 블록으로 묶고, select로 등록/수정/삭제 모드를 전환한다."
    >
      <div style={C.info('yellow')}>
        키워드는 <strong>code 변경 불가</strong>, 피드백 태그는{' '}
        <strong>code·voteChoice 변경 불가</strong>다.
      </div>

      <div style={C.card}>
        <h3 style={C.h3}>🏷️ 키워드 관리</h3>
        <div style={C.info('blue')}>
          키워드 삭제는 <strong>미사용 키워드만 가능</strong>하다. 수정 시 code는 변경할 수 없다.
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <SelectField
            label="목록 필터 isActive"
            value={keywordIsActiveFilter}
            onChange={(v) => setKeywordIsActiveFilter(v as BoolSelect)}
            width={220}
            options={[
              { value: '', label: '전체' },
              { value: 'true', label: '활성만' },
              { value: 'false', label: '비활성만' },
            ]}
          />
          <SelectField
            label="관리 모드"
            value={keywordMode}
            onChange={(v) => setKeywordMode(v as CrudMode)}
            width={240}
            options={[
              { value: 'CREATE', label: '등록' },
              { value: 'UPDATE', label: '수정' },
              { value: 'DELETE', label: '삭제' },
            ]}
          />
        </div>

        <button
          style={C.btn('#553c9a')}
          onClick={() =>
            run(
              () => api('GET', `/admin/keywords${qs({ isActive: keywordIsActiveFilter })}`),
              setRes,
            )
          }
        >
          키워드 목록 조회
        </button>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
          {keywordMode === 'CREATE' && (
            <>
              <Field
                label="code"
                value={keywordCode}
                onChange={setKeywordCode}
                placeholder="ex) STREET_LOOK"
              />
              <Field
                label="label"
                value={keywordLabel}
                onChange={setKeywordLabel}
                placeholder="ex) 스트릿 룩"
              />
              <Field
                label="sortOrder (선택)"
                value={keywordSortOrder}
                onChange={setKeywordSortOrder}
                placeholder="0"
              />
              <SelectField
                label="isActive (선택)"
                value={keywordIsActive}
                onChange={setKeywordIsActive}
                options={[
                  { value: 'true', label: 'true' },
                  { value: 'false', label: 'false' },
                ]}
              />
              <button
                style={C.btn('#38a169')}
                onClick={() =>
                  run(
                    () =>
                      api('POST', '/admin/keywords', {
                        code: keywordCode.trim(),
                        label: keywordLabel.trim(),
                        sortOrder: Number(keywordSortOrder || '0'),
                        isActive: keywordIsActive === 'true',
                      }),
                    setRes,
                  )
                }
              >
                키워드 등록
              </button>
            </>
          )}

          {keywordMode === 'UPDATE' && (
            <>
              <Field
                label="keywordId"
                value={keywordId}
                onChange={setKeywordId}
                placeholder="ex) 1"
              />
              <Field
                label="code (변경 불가)"
                value="생성 후 변경 불가"
                onChange={() => {}}
                disabled
              />
              <Field
                label="label"
                value={keywordLabel}
                onChange={setKeywordLabel}
                placeholder="ex) 캐주얼 룩"
              />
              <Field
                label="sortOrder (선택)"
                value={keywordSortOrder}
                onChange={setKeywordSortOrder}
                placeholder="5"
              />
              <SelectField
                label="isActive (선택)"
                value={keywordIsActive}
                onChange={setKeywordIsActive}
                options={[
                  { value: 'true', label: 'true' },
                  { value: 'false', label: 'false' },
                ]}
              />
              <button
                style={C.btn('#ed8936')}
                onClick={() => {
                  const body: Record<string, unknown> = {};
                  if (keywordLabel.trim()) body.label = keywordLabel.trim();
                  if (keywordSortOrder.trim()) body.sortOrder = Number(keywordSortOrder);
                  body.isActive = keywordIsActive === 'true';
                  run(() => api('PATCH', `/admin/keywords/${keywordId}`, body), setRes);
                }}
              >
                키워드 수정
              </button>
            </>
          )}

          {keywordMode === 'DELETE' && (
            <>
              <div style={C.info('red')}>
                삭제는 <strong>미사용 키워드만</strong> 가능하다. 사용 중이면 conflict가 날 수 있다.
              </div>
              <Field
                label="keywordId"
                value={keywordId}
                onChange={setKeywordId}
                placeholder="ex) 1"
              />
              <button
                style={C.btn('#c53030')}
                onClick={() => run(() => api('DELETE', `/admin/keywords/${keywordId}`), setRes)}
              >
                키워드 삭제
              </button>
            </>
          )}
        </div>
      </div>

      <div style={C.card}>
        <h3 style={C.h3}>💬 피드백 태그 관리</h3>
        <div style={C.info('blue')}>
          피드백 태그 삭제는 <strong>미사용 태그만 가능</strong>하다. 수정 시 code와 voteChoice는
          변경할 수 없다.
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <SelectField
            label="목록 필터 voteChoice"
            value={tagVoteChoiceFilter}
            onChange={setTagVoteChoiceFilter}
            width={220}
            options={[
              { value: '', label: '전체' },
              { value: 'LIKE', label: 'LIKE — 좋아요 피드백' },
              { value: 'DISLIKE', label: 'DISLIKE — 싫어요 피드백' },
            ]}
          />
          <Field
            label="목록 필터 groupCode"
            value={tagGroupCodeFilter}
            onChange={setTagGroupCodeFilter}
            placeholder="예: STYLE"
          />
          <SelectField
            label="목록 필터 isActive"
            value={tagIsActiveFilter}
            onChange={(v) => setTagIsActiveFilter(v as BoolSelect)}
            width={220}
            options={[
              { value: '', label: '전체' },
              { value: 'true', label: '활성만' },
              { value: 'false', label: '비활성만' },
            ]}
          />
          <SelectField
            label="관리 모드"
            value={tagMode}
            onChange={(v) => setTagMode(v as CrudMode)}
            width={240}
            options={[
              { value: 'CREATE', label: '등록' },
              { value: 'UPDATE', label: '수정' },
              { value: 'DELETE', label: '삭제' },
            ]}
          />
        </div>

        <button
          style={C.btn('#553c9a')}
          onClick={() =>
            run(
              () =>
                api(
                  'GET',
                  `/admin/feedback-tags${qs({
                    voteChoice: tagVoteChoiceFilter,
                    groupCode: tagGroupCodeFilter,
                    isActive: tagIsActiveFilter,
                  })}`,
                ),
              setRes,
            )
          }
        >
          피드백 태그 목록 조회
        </button>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
          {tagMode === 'CREATE' && (
            <>
              <Field
                label="code"
                value={tagCode}
                onChange={setTagCode}
                placeholder="ex) TRENDY_STYLE"
              />
              <Field
                label="label"
                value={tagLabel}
                onChange={setTagLabel}
                placeholder="ex) 트렌디한 스타일"
              />
              <SelectField
                label="voteChoice"
                value={tagVoteChoice}
                onChange={setTagVoteChoice}
                options={[
                  { value: 'LIKE', label: 'LIKE — 좋아요 피드백' },
                  { value: 'DISLIKE', label: 'DISLIKE — 싫어요 피드백' },
                ]}
              />
              <Field
                label="groupCode (선택)"
                value={tagGroupCode}
                onChange={setTagGroupCode}
                placeholder="예: STYLE"
              />
              <Field
                label="sortOrder (선택)"
                value={tagSortOrder}
                onChange={setTagSortOrder}
                placeholder="0"
              />
              <SelectField
                label="isActive (선택)"
                value={tagIsActive}
                onChange={setTagIsActive}
                options={[
                  { value: 'true', label: 'true' },
                  { value: 'false', label: 'false' },
                ]}
              />
              <button
                style={C.btn('#38a169')}
                onClick={() =>
                  run(
                    () =>
                      api('POST', '/admin/feedback-tags', {
                        code: tagCode.trim(),
                        label: tagLabel.trim(),
                        voteChoice: tagVoteChoice,
                        groupCode: tagGroupCode.trim() ? tagGroupCode.trim() : undefined,
                        sortOrder: Number(tagSortOrder || '0'),
                        isActive: tagIsActive === 'true',
                      }),
                    setRes,
                  )
                }
              >
                피드백 태그 등록
              </button>
            </>
          )}

          {tagMode === 'UPDATE' && (
            <>
              <Field label="tagId" value={tagId} onChange={setTagId} placeholder="ex) 2" />
              <Field
                label="code (변경 불가)"
                value="생성 후 변경 불가"
                onChange={() => {}}
                disabled
              />
              <Field
                label="voteChoice (변경 불가)"
                value="생성 후 변경 불가"
                onChange={() => {}}
                disabled
              />
              <Field
                label="label"
                value={tagLabel}
                onChange={setTagLabel}
                placeholder="ex) 세련된 스타일"
              />
              <Field
                label="groupCode (선택, 빈 값이면 제거)"
                value={tagGroupCode}
                onChange={setTagGroupCode}
                placeholder="예: COLOR"
              />
              <Field
                label="sortOrder (선택)"
                value={tagSortOrder}
                onChange={setTagSortOrder}
                placeholder="5"
              />
              <SelectField
                label="isActive (선택)"
                value={tagIsActive}
                onChange={setTagIsActive}
                options={[
                  { value: 'true', label: 'true' },
                  { value: 'false', label: 'false' },
                ]}
              />
              <button
                style={C.btn('#ed8936')}
                onClick={() => {
                  const body: Record<string, unknown> = {};
                  if (tagLabel.trim()) body.label = tagLabel.trim();
                  body.groupCode = tagGroupCode.trim() ? tagGroupCode.trim() : null;
                  if (tagSortOrder.trim()) body.sortOrder = Number(tagSortOrder);
                  body.isActive = tagIsActive === 'true';
                  run(() => api('PATCH', `/admin/feedback-tags/${tagId}`, body), setRes);
                }}
              >
                피드백 태그 수정
              </button>
            </>
          )}

          {tagMode === 'DELETE' && (
            <>
              <div style={C.info('red')}>
                삭제는 <strong>미사용 태그만</strong> 가능하다. 사용 중이면 conflict가 날 수 있다.
              </div>
              <Field label="tagId" value={tagId} onChange={setTagId} placeholder="ex) 2" />
              <button
                style={C.btn('#c53030')}
                onClick={() => run(() => api('DELETE', `/admin/feedback-tags/${tagId}`), setRes)}
              >
                피드백 태그 삭제
              </button>
            </>
          )}
        </div>
      </div>

      <Result data={res} />
    </PageShell>
  );
}

// ─── 제재 관리 ───────────────────────────────────────────────────────────────

function S_AdminSanctions() {
  const [res, setRes] = useState('');

  const [listUserId, setListUserId] = useState('');
  const [listType, setListType] = useState('');
  const [listCursor, setListCursor] = useState('');
  const [listLimit, setListLimit] = useState('20');

  const [genericUserId, setGenericUserId] = useState('');
  const [genericType, setGenericType] = useState('POST_RESTRICTION');
  const [genericReason, setGenericReason] = useState('');
  const [genericStartsAt, setGenericStartsAt] = useState('');
  const [genericEndsAt, setGenericEndsAt] = useState('');

  const [endSanctionId, setEndSanctionId] = useState('');
  const [endSanctionReason, setEndSanctionReason] = useState('');

  const [restrictionUserId, setRestrictionUserId] = useState('');
  const [restrictionReason, setRestrictionReason] = useState('');
  const [restrictionStartsAt, setRestrictionStartsAt] = useState('');
  const [restrictionEndsAt, setRestrictionEndsAt] = useState('');

  return (
    <PageShell
      title="🚫 제재 관리"
      description="범용 제재 경로와 유형 고정 경로를 함께 테스트한다."
    >
      <div style={C.card}>
        <h3 style={C.h3}>📋 제재 목록 조회</h3>
        <Field
          label="userId (선택)"
          value={listUserId}
          onChange={setListUserId}
          placeholder="ex) 7"
        />
        <SelectField
          label="type 필터"
          value={listType}
          onChange={setListType}
          options={[
            { value: '', label: '전체' },
            { value: 'TEMP_SUSPENSION', label: 'TEMP_SUSPENSION — 로그인 제한' },
            { value: 'PERMANENT_BAN', label: 'PERMANENT_BAN — 영구 정지' },
            { value: 'POST_RESTRICTION', label: 'POST_RESTRICTION — 게시글 작성 제한' },
          ]}
        />
        <Field
          label="cursor (선택)"
          value={listCursor}
          onChange={setListCursor}
          placeholder="ex) 10"
        />
        <Field
          label="limit (선택, 기본 20)"
          value={listLimit}
          onChange={setListLimit}
          placeholder="20"
        />
        <button
          style={C.btn('#553c9a')}
          onClick={() =>
            run(
              () =>
                api(
                  'GET',
                  `/admin/sanctions${qs({
                    userId: listUserId,
                    type: listType,
                    cursor: listCursor,
                    limit: listLimit,
                  })}`,
                ),
              setRes,
            )
          }
        >
          제재 목록 조회
        </button>
        <button
          style={C.btn('#718096')}
          onClick={() =>
            run(
              () =>
                api(
                  'GET',
                  `/admin/user-sanctions${qs({
                    userId: listUserId,
                    type: listType,
                    cursor: listCursor,
                    limit: listLimit,
                  })}`,
                ),
              setRes,
            )
          }
        >
          유저 제재 목록 조회
        </button>
      </div>

      <div style={C.card}>
        <h3 style={C.h3}>➕ 사용자 제재 생성</h3>
        <div style={C.info('yellow')}>
          <strong>PERMANENT_BAN</strong>은 SUPER_ADMIN 전용이다.
        </div>
        <Field
          label="sanctionedUserId"
          value={genericUserId}
          onChange={setGenericUserId}
          placeholder="ex) 7"
        />
        <SelectField
          label="type"
          value={genericType}
          onChange={setGenericType}
          options={[
            { value: 'POST_RESTRICTION', label: 'POST_RESTRICTION — 게시글 작성 제한' },
            { value: 'TEMP_SUSPENSION', label: 'TEMP_SUSPENSION — 로그인 제한' },
            { value: 'PERMANENT_BAN', label: 'PERMANENT_BAN — 영구 정지' },
          ]}
        />
        <TextAreaField
          label="reason"
          value={genericReason}
          onChange={setGenericReason}
          placeholder="반복 규정 위반"
        />
        <Field
          label="startsAt (선택, ISO 8601)"
          value={genericStartsAt}
          onChange={setGenericStartsAt}
          placeholder="2026-04-23T00:00:00.000Z"
        />
        <Field
          label="endsAt (선택, ISO 8601)"
          value={genericEndsAt}
          onChange={setGenericEndsAt}
          placeholder="2026-05-23T00:00:00.000Z"
        />
        <button
          style={C.btn(genericType === 'PERMANENT_BAN' ? '#c53030' : '#553c9a')}
          onClick={() => {
            const body: Record<string, unknown> = {
              sanctionedUserId: Number(genericUserId),
              type: genericType,
              reason: genericReason.trim(),
            };
            if (genericStartsAt.trim()) body.startsAt = genericStartsAt.trim();
            if (genericEndsAt.trim()) body.endsAt = genericEndsAt.trim();
            run(() => api('POST', '/admin/sanctions', body), setRes);
          }}
        >
          사용자 제재 생성
        </button>
      </div>

      <div style={C.card}>
        <h3 style={C.h3}>⏹️ 제재 조기 종료</h3>
        <Field
          label="sanctionId"
          value={endSanctionId}
          onChange={setEndSanctionId}
          placeholder="ex) 4"
        />
        <TextAreaField
          label="종료 사유 (선택)"
          value={endSanctionReason}
          onChange={setEndSanctionReason}
          placeholder="당사자 요청으로 조기 종료"
        />
        <button
          style={C.btn('#ed8936')}
          onClick={() => {
            const body: Record<string, unknown> = {};
            if (endSanctionReason.trim()) body.reason = endSanctionReason.trim();
            run(() => api('PATCH', `/admin/sanctions/${endSanctionId}/end`, body), setRes);
          }}
        >
          제재 종료
        </button>
      </div>

      <div style={C.card}>
        <h3 style={C.h3}>➕ 게시글 제한 / 로그인 제한 생성</h3>
        <Field
          label="userId"
          value={restrictionUserId}
          onChange={setRestrictionUserId}
          placeholder="ex) 7"
        />
        <TextAreaField
          label="reason"
          value={restrictionReason}
          onChange={setRestrictionReason}
          placeholder="반복 위반 행위"
        />
        <Field
          label="startsAt (선택, ISO 8601)"
          value={restrictionStartsAt}
          onChange={setRestrictionStartsAt}
          placeholder="2026-04-23T00:00:00.000Z"
        />
        <Field
          label="endsAt (선택, ISO 8601)"
          value={restrictionEndsAt}
          onChange={setRestrictionEndsAt}
          placeholder="2026-05-23T00:00:00.000Z"
        />
        <button
          style={C.btn('#553c9a')}
          onClick={() => {
            const body: Record<string, unknown> = { reason: restrictionReason.trim() };
            if (restrictionStartsAt.trim()) body.startsAt = restrictionStartsAt.trim();
            if (restrictionEndsAt.trim()) body.endsAt = restrictionEndsAt.trim();
            run(
              () =>
                api('POST', `/admin/users/${restrictionUserId}/sanctions/post-restriction`, body),
              setRes,
            );
          }}
        >
          게시글 제한 제재 생성
        </button>
        <button
          style={C.btn('#553c9a')}
          onClick={() => {
            const body: Record<string, unknown> = { reason: restrictionReason.trim() };
            if (restrictionStartsAt.trim()) body.startsAt = restrictionStartsAt.trim();
            if (restrictionEndsAt.trim()) body.endsAt = restrictionEndsAt.trim();
            run(
              () =>
                api('POST', `/admin/users/${restrictionUserId}/sanctions/login-restriction`, body),
              setRes,
            );
          }}
        >
          로그인 제한 제재 생성
        </button>
      </div>

      <Result data={res} />
    </PageShell>
  );
}

// ─── 로그·이력 ───────────────────────────────────────────────────────────────

function S_AdminLogs() {
  const [res, setRes] = useState('');

  const [adminId, setAdminId] = useState('');
  const [targetType, setTargetType] = useState('');
  const [actionType, setActionType] = useState('');
  const [actionCursor, setActionCursor] = useState('');
  const [actionLimit, setActionLimit] = useState('20');

  const [historyTargetType, setHistoryTargetType] = useState('');
  const [historyTargetId, setHistoryTargetId] = useState('');
  const [historyCursor, setHistoryCursor] = useState('');
  const [historyLimit, setHistoryLimit] = useState('20');

  return (
    <PageShell
      title="📜 로그·이력"
      description="관리자 액션 로그와 신고 이력을 query DTO 기준으로 조회한다."
    >
      <div style={C.card}>
        <h3 style={C.h3}>📜 관리자 액션 로그 조회</h3>
        <Field label="adminId (선택)" value={adminId} onChange={setAdminId} placeholder="ex) 1" />
        <SelectField
          label="targetType (선택)"
          value={targetType}
          onChange={setTargetType}
          options={[
            { value: '', label: '전체' },
            { value: 'POST', label: 'POST' },
            { value: 'POST_REPORT', label: 'POST_REPORT' },
            { value: 'USER_REPORT', label: 'USER_REPORT' },
            { value: 'USER', label: 'USER' },
            { value: 'USER_SANCTION', label: 'USER_SANCTION' },
          ]}
        />
        <SelectField
          label="actionType (선택)"
          value={actionType}
          onChange={setActionType}
          options={[
            { value: '', label: '전체' },
            { value: 'CREATED', label: 'CREATED' },
            { value: 'RESOLVED', label: 'RESOLVED' },
            { value: 'REJECTED', label: 'REJECTED' },
            { value: 'REOPENED', label: 'REOPENED' },
            { value: 'HIDDEN', label: 'HIDDEN' },
            { value: 'UNHIDDEN', label: 'UNHIDDEN' },
            { value: 'DELETED', label: 'DELETED' },
            { value: 'RESTORED', label: 'RESTORED' },
            { value: 'SANCTION_UPDATED', label: 'SANCTION_UPDATED' },
            { value: 'SANCTION_ENDED', label: 'SANCTION_ENDED' },
            { value: 'USER_STATUS_UPDATED', label: 'USER_STATUS_UPDATED' },
          ]}
        />
        <Field
          label="cursor (선택)"
          value={actionCursor}
          onChange={setActionCursor}
          placeholder="ex) 100"
        />
        <Field
          label="limit (선택, 기본 20)"
          value={actionLimit}
          onChange={setActionLimit}
          placeholder="20"
        />
        <button
          style={C.btn('#553c9a')}
          onClick={() =>
            run(
              () =>
                api(
                  'GET',
                  `/admin/action-logs${qs({
                    adminId,
                    targetType,
                    actionType,
                    cursor: actionCursor,
                    limit: actionLimit,
                  })}`,
                ),
              setRes,
            )
          }
        >
          액션 로그 조회
        </button>
      </div>

      <div style={C.card}>
        <h3 style={C.h3}>📋 신고 이력 조회</h3>
        <SelectField
          label="targetType (선택)"
          value={historyTargetType}
          onChange={setHistoryTargetType}
          options={[
            { value: '', label: '전체' },
            { value: 'POST_REPORT', label: 'POST_REPORT — 게시글 신고' },
            { value: 'USER_REPORT', label: 'USER_REPORT — 사용자 신고' },
          ]}
        />
        <Field
          label="targetId (선택)"
          value={historyTargetId}
          onChange={setHistoryTargetId}
          placeholder="ex) 3"
        />
        <Field
          label="cursor (선택)"
          value={historyCursor}
          onChange={setHistoryCursor}
          placeholder="ex) 50"
        />
        <Field
          label="limit (선택, 기본 20)"
          value={historyLimit}
          onChange={setHistoryLimit}
          placeholder="20"
        />
        <button
          style={C.btn('#553c9a')}
          onClick={() =>
            run(
              () =>
                api(
                  'GET',
                  `/admin/report-histories${qs({
                    targetType: historyTargetType,
                    targetId: historyTargetId,
                    cursor: historyCursor,
                    limit: historyLimit,
                  })}`,
                ),
              setRes,
            )
          }
        >
          신고 이력 조회
        </button>
      </div>

      <Result data={res} />
    </PageShell>
  );
}

// ─── 섹션 정의 ───────────────────────────────────────────────────────────────

const SECTIONS: {
  key: AdminPageKey;
  label: string;
}[] = [
  { key: 'admin-home', label: '🏠 관리자 홈' },
  { key: 'admin-reports', label: '🚨 신고 관리' },
  { key: 'admin-operations', label: '⚙️ 게시글·회원 운영' },
  { key: 'admin-masters', label: '📚 마스터 관리' },
  { key: 'admin-sanctions', label: '🚫 제재 관리' },
  { key: 'admin-logs', label: '📜 로그·이력' },
];

function AdminActiveSection({
  active,
  onMove,
}: {
  active: AdminPageKey;
  onMove: (page: AdminPageKey) => void;
}) {
  switch (active) {
    case 'admin-home':
      return <S_AdminHome onMove={onMove} />;
    case 'admin-reports':
      return <S_AdminReports />;
    case 'admin-operations':
      return <S_AdminOperations />;
    case 'admin-masters':
      return <S_AdminMasters />;
    case 'admin-sanctions':
      return <S_AdminSanctions />;
    case 'admin-logs':
      return <S_AdminLogs />;
    default:
      return null;
  }
}

// ─── 루트 ────────────────────────────────────────────────────────────────────

export default function Admin() {
  const [active, setActive] = useState<AdminPageKey>('admin-home');

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        fontFamily: "'Pretendard', 'Inter', -apple-system, sans-serif",
        background: '#f7fafc',
      }}
    >
      <aside
        style={{
          width: 220,
          background: '#1a202c',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflowY: 'auto',
        }}
      >
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid #2d3748' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            C:dinator V3
          </div>
          <div style={{ fontSize: 11, color: '#718096', marginTop: 3 }}>Admin Panel</div>
        </div>

        <nav style={{ padding: '8px 0', flex: 1 }}>
          {SECTIONS.map((sec) => (
            <button
              key={sec.key}
              onClick={() => setActive(sec.key)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 16px',
                background: active === sec.key ? '#2d3748' : 'transparent',
                border: 'none',
                borderLeft: `3px solid ${active === sec.key ? '#63b3ed' : 'transparent'}`,
                color: active === sec.key ? '#fff' : '#a0aec0',
                fontSize: 13,
                cursor: 'pointer',
                fontWeight: active === sec.key ? 700 : 500,
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

      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <div style={{ maxWidth: 860 }}>
          <AdminActiveSection active={active} onMove={setActive} />
        </div>
      </main>
    </div>
  );
}
