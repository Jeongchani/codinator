import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type {
  DeleteMeResponse,
  GetMeResponse,
  GetMyActivitySummaryResponse,
} from '@codinator/contracts';
import { clearAuthTokens, fetcher, getAuthHeaders } from '../../lib/api';
import SideMenu from '../../components/SideMenu';
import styles from './MyPage.module.css';

type ProfileState = {
  email: string;
  nickname: string;
  phoneNumber: string;
};

type ActivitySummaryState = {
  top10Count: number;
  myPostCount: number;
  votedPostCount: number;
};

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmText: string;
  cancelText?: string;
  confirmTone?: 'default' | 'danger';
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
};

type PasswordModalProps = {
  open: boolean;
  password: string;
  errorMessage: string;
  loading: boolean;
  onPasswordChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

const getMyProfile = async (): Promise<GetMeResponse> => {
  return fetcher<GetMeResponse>('/users/me', {
    headers: getAuthHeaders(),
  });
};

const getMyActivitySummary = async (): Promise<GetMyActivitySummaryResponse> => {
  return fetcher<GetMyActivitySummaryResponse>('/users/me/activity-summary', {
    headers: getAuthHeaders(),
  });
};

const verifyCurrentPassword = async (payload: {
  email: string;
  password: string;
}): Promise<void> => {
  await fetcher('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};

const deleteMyAccount = async (): Promise<DeleteMeResponse> => {
  return fetcher<DeleteMeResponse>('/users/me', {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
};

function ConfirmModal({
  open,
  title,
  description,
  confirmText,
  cancelText = '취소',
  confirmTone = 'default',
  onConfirm,
  onClose,
  loading = false,
}: ConfirmModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className={styles.modalTitle}>{title}</h2>
        {description ? <p className={styles.modalDescription}>{description}</p> : null}

        <div className={styles.modalButtonRow}>
          <button type="button" className={styles.modalCancelButton} onClick={onClose}>
            {cancelText}
          </button>
          <button
            type="button"
            className={
              confirmTone === 'danger' ? styles.modalDangerButton : styles.modalConfirmButton
            }
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '처리 중...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordModal({
  open,
  password,
  errorMessage,
  loading,
  onPasswordChange,
  onClose,
  onConfirm,
}: PasswordModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className={styles.modalTitle}>비밀번호 확인</h2>
        <p className={styles.modalDescription}>회원정보 변경 전 현재 비밀번호를 입력해 주세요.</p>

        <input
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder="현재 비밀번호"
          className={styles.passwordModalInput}
        />

        <p className={`${styles.modalHelperText} ${errorMessage ? styles.modalHelperError : ''}`}>
          {errorMessage || '정보 변경 페이지 진입 전에 한 번만 확인합니다.'}
        </p>

        <div className={styles.modalButtonRow}>
          <button type="button" className={styles.modalCancelButton} onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className={styles.modalConfirmButton}
            onClick={onConfirm}
            disabled={!password.trim() || loading}
          >
            {loading ? '확인 중...' : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}

const formatPhoneNumber = (value: string) => {
  const digits = value.replace(/[^0-9]/g, '');

  if (!digits) {
    return '-';
  }

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  const middleLength = digits.length === 10 ? 3 : 4;
  return `${digits.slice(0, 3)}-${digits.slice(3, 3 + middleLength)}-${digits.slice(3 + middleLength, 3 + middleLength + 4)}`;
};

export default function MyPage() {
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileState>({
    email: '',
    nickname: '',
    phoneNumber: '',
  });
  const [summary, setSummary] = useState<ActivitySummaryState>({
    top10Count: 0,
    myPostCount: 0,
    votedPostCount: 0,
  });

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifyErrorMessage, setVerifyErrorMessage] = useState('');
  const [verifying, setVerifying] = useState(false);

  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    const loadMyPage = async () => {
      try {
        const [profileResponse, summaryResponse] = await Promise.all([
          getMyProfile(),
          getMyActivitySummary(),
        ]);

        setProfile({
          email: profileResponse.email,
          nickname: profileResponse.nickname,
          phoneNumber: profileResponse.phoneNumber,
        });
        setSummary({
          top10Count: summaryResponse.top10Count,
          myPostCount: summaryResponse.myPostCount,
          votedPostCount: summaryResponse.votedPostCount,
        });
      } catch (error) {
        console.error('마이페이지 조회 실패:', error);
        window.alert(
          error instanceof Error ? error.message : '마이페이지 정보를 불러오지 못했습니다.',
        );
      } finally {
        setLoading(false);
      }
    };

    void loadMyPage();
  }, []);

  const handleOpenEdit = () => {
    setVerifyPassword('');
    setVerifyErrorMessage('');
    setPasswordModalOpen(true);
  };

  const handleVerifyBeforeEdit = async () => {
    if (!verifyPassword.trim()) {
      return;
    }

    setVerifying(true);
    setVerifyErrorMessage('');

    try {
      await verifyCurrentPassword({
        email: profile.email,
        password: verifyPassword.trim(),
      });

      setPasswordModalOpen(false);
      navigate('/myPage/edit', {
        state: {
          verifiedCurrentPassword: verifyPassword.trim(),
        },
      });
    } catch (error) {
      console.error('비밀번호 인증 실패:', error);
      setVerifyErrorMessage('비밀번호가 올바르지 않습니다.');
    } finally {
      setVerifying(false);
    }
  };

  const handleWithdraw = async () => {
    setWithdrawing(true);

    try {
      await deleteMyAccount();
      clearAuthTokens();
      navigate('/loginSelect', { replace: true });
    } catch (error) {
      console.error('회원 탈퇴 실패:', error);
      window.alert(error instanceof Error ? error.message : '회원 탈퇴에 실패했습니다.');
    } finally {
      setWithdrawing(false);
      setWithdrawModalOpen(false);
    }
  };

  return (
    <>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <button
              type="button"
              className={styles.headerIconButton}
              onClick={() => navigate(-1)}
              aria-label="뒤로가기"
            >
              <ChevronLeft size={23} strokeWidth={2.2} />
            </button>

            <h1 className={styles.title}>마이 페이지</h1>

            <button
              type="button"
              className={styles.menuButton}
              onClick={() => setMenuOpen(true)}
              aria-label="사이드 메뉴 열기"
            >
              <Menu size={25} strokeWidth={2.2} />
            </button>
          </div>
        </header>

        <main className={styles.contentArea}>
          <section className={styles.nicknameSection}>
            <strong className={styles.nicknameText}>
              {loading ? '불러오는 중...' : profile.nickname || '닉네임'}
            </strong>
          </section>

          <section className={styles.sectionBlock}>
            <h2 className={styles.sectionTitle}>내 활동 요약</h2>

            <div className={styles.summaryGrid}>
              <article className={styles.summaryCard}>
                <p className={styles.summaryLabel}>
                  TOP 10
                  <br />
                  진입
                </p>
                <strong className={styles.summaryValue}>
                  {loading ? '-' : `${summary.top10Count}회`}
                </strong>
              </article>

              <article className={styles.summaryCard}>
                <p className={styles.summaryLabel}>
                  올린
                  <br />
                  게시글
                </p>
                <strong className={styles.summaryValue}>
                  {loading ? '-' : `${summary.myPostCount}개`}
                </strong>
              </article>

              <article className={styles.summaryCard}>
                <p className={styles.summaryLabel}>
                  평가한
                  <br />
                  게시글
                </p>
                <strong className={styles.summaryValue}>
                  {loading ? '-' : `${summary.votedPostCount}개`}
                </strong>
              </article>
            </div>
          </section>

          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeaderRow}>
              <h2 className={styles.sectionTitle}>계정 정보</h2>

              <button type="button" className={styles.changeButton} onClick={handleOpenEdit}>
                <span>변경하기</span>
                <ChevronRight size={18} strokeWidth={2.2} />
              </button>
            </div>

            <div className={styles.accountCard}>
              <div className={styles.accountRow}>
                <span className={styles.accountLabel}>닉네임</span>
                <span className={styles.accountValue}>{loading ? '-' : profile.nickname}</span>
              </div>
              <div className={styles.divider} />

              <div className={styles.accountRow}>
                <span className={styles.accountLabel}>이메일</span>
                <span className={styles.accountValue}>{loading ? '-' : profile.email}</span>
              </div>
              <div className={styles.divider} />

              <div className={styles.accountRow}>
                <span className={styles.accountLabel}>비밀번호</span>
                <span className={styles.accountValue}>********</span>
              </div>
              <div className={styles.divider} />

              <div className={styles.accountRow}>
                <span className={styles.accountLabel}>전화번호</span>
                <span className={styles.accountValue}>
                  {loading ? '-' : formatPhoneNumber(profile.phoneNumber)}
                </span>
              </div>
            </div>
          </section>

          <button
            type="button"
            className={styles.withdrawButton}
            onClick={() => setWithdrawModalOpen(true)}
          >
            회원탈퇴
          </button>
        </main>
      </div>

      <SideMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <PasswordModal
        open={passwordModalOpen}
        password={verifyPassword}
        errorMessage={verifyErrorMessage}
        loading={verifying}
        onPasswordChange={setVerifyPassword}
        onClose={() => {
          if (verifying) return;
          setPasswordModalOpen(false);
        }}
        onConfirm={handleVerifyBeforeEdit}
      />

      <ConfirmModal
        open={withdrawModalOpen}
        title="회원탈퇴 하시겠습니까?"
        description="탈퇴 후에는 계정을 복구할 수 없습니다."
        confirmText="회원탈퇴"
        confirmTone="danger"
        loading={withdrawing}
        onClose={() => {
          if (withdrawing) return;
          setWithdrawModalOpen(false);
        }}
        onConfirm={handleWithdraw}
      />
    </>
  );
}
