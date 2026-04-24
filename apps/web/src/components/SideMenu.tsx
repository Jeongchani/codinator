import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Images,
  Bookmark,
  Trophy,
  ClipboardCheck,
  User,
  Settings,
  LogOut,
  ChevronRight,
  Vote,
} from 'lucide-react';
import styles from './SideMenu.module.css';
import { logoutWithServer } from '../lib/api';

type SideMenuProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

type MenuItemProps = {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  showArrow?: boolean;
};

function MenuItem({ icon, label, onClick, showArrow = true }: MenuItemProps) {
  return (
    <button type="button" className={styles.menuItem} onClick={onClick}>
      <div className={styles.menuItemLeft}>
        <span className={styles.iconWrap}>{icon}</span>
        <span className={styles.menuLabel}>{label}</span>
      </div>

      {showArrow ? (
        <span className={styles.arrowIcon}>
          <ChevronRight size={18} strokeWidth={2.4} />
        </span>
      ) : null}
    </button>
  );
}

export default function SideMenu({ isOpen = false, onClose }: SideMenuProps) {
  const navigate = useNavigate();

  const handleMove = (path: string) => {
    onClose?.();
    navigate(path);
  };

  const handleLogout = async () => {
    try {
      await logoutWithServer();
    } finally {
      onClose?.();
      navigate('/login', { replace: true });
    }
  };

  return (
    <div
      className={`${styles.wrapper} ${isOpen ? styles.open : styles.closed}`}
      onClick={onClose}
      role="presentation"
      aria-hidden={!isOpen}
    >
      <div className={styles.overlay} />

      <aside
        className={`${styles.panel} ${isOpen ? styles.panelOpen : styles.panelClosed}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="사이드 메뉴"
      >
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="메뉴 닫기"
        >
          <Menu size={25} strokeWidth={2.2} />
        </button>

        <div className={styles.mainTitle}>Main</div>

        <div className={styles.mainOptions}>
          <MenuItem
            icon={<Trophy size={25} strokeWidth={2.2} />}
            label="랭킹존"
            onClick={() => handleMove('/rankingZone')}
          />

          <MenuItem
            icon={<Vote size={25} strokeWidth={2.2} />}
            label="평가존"
            onClick={() => handleMove('/evaluationZone')}
          />
          <MenuItem
            icon={<Images size={25} strokeWidth={2.2} />}
            label="내 피드"
            onClick={() => handleMove('/myFeed')}
          />

          <MenuItem
            icon={<Bookmark size={25} strokeWidth={2.2} />}
            label="내 북마크"
            onClick={() => handleMove('/bookmark')}
          />
        </div>

        <div className={styles.otherTitle}>Other</div>

        <div className={styles.otherOptions}>
          <MenuItem
            icon={<User size={25} strokeWidth={2.2} />}
            label="마이 페이지"
            onClick={() => handleMove('/myPage')}
          />
          <MenuItem
            icon={<ClipboardCheck size={25} strokeWidth={2.2} />}
            label="진행중인 평가 기록"
            onClick={() => handleMove('/ongoingEvaluationHistory')}
          />

          <MenuItem
            icon={<Settings size={25} strokeWidth={2.2} />}
            label="설정"
            onClick={() => handleMove('/settings')}
          />
        </div>

        <div className={styles.logoutArea}>
          <button type="button" className={styles.logoutButton} onClick={handleLogout}>
            <span className={styles.logoutIcon}>
              <LogOut size={20} strokeWidth={2.2} />
            </span>
            <span className={styles.logoutText}>로그아웃</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
