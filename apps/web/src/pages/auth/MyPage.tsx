import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { GetMeResponse, GetMyActivitySummaryResponse } from '@codinator/contracts';
import { fetcher, getAuthHeaders } from '../../lib/api';
import Header from '../../components/Header';
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
  return `${digits.slice(0, 3)}-${digits.slice(3, 3 + middleLength)}-${digits.slice(
    3 + middleLength,
    3 + middleLength + 4,
  )}`;
};

export default function MyPage() {
  const navigate = useNavigate();

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

  return (
    <>
      <div className={styles.container}>
        <Header
          title="마이 페이지"
          leftAction="back"
          onBack={() => navigate(-1)}
          rightAction="menu"
        />

        <main className={styles.contentArea}>
          <section className={styles.summarySection}>
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
                <span>계정 정보 수정</span>
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
        </main>
      </div>


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
    </>
  );
}
