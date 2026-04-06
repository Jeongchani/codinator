import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  Images,
  Bookmark,
  Trophy,
  ClipboardCheck,
  User,
  Settings,
  LogOut,
} from "lucide-react";
import styles from "./SideMenu.module.css";

type SideMenuProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

type MenuItemProps = {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
};

function MenuItem({ icon, label, onClick }: MenuItemProps) {
  return (
    <button type="button" className={styles.menuItem} onClick={onClick}>
      <span className={styles.iconWrap}>{icon}</span>
      <span className={styles.menuLabel}>{label}</span>
    </button>
  );
}

export default function SideMenu({
  isOpen = false,
  onClose,
}: SideMenuProps) {
  const navigate = useNavigate();

  const handleMove = (path: string) => {
    onClose?.();
    navigate(path);
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("token");
    onClose?.();
    navigate("/login");
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
      >
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="메뉴 닫기"
        >
          <Menu size={25} strokeWidth={2.2} />
        </button>

        <div className={styles.mainOptions}>
          <MenuItem
            icon={<ClipboardCheck size={20} strokeWidth={2.2} />}
            label="평가존"
            onClick={() => handleMove("/evaluationzone")}
          />

          <MenuItem
            icon={<Trophy size={20} strokeWidth={2.2} />}
            label="랭킹존"
            onClick={() => handleMove("/rankingzone")}
          />
          <MenuItem
            icon={<Images size={20} strokeWidth={2.2} />}
            label="내 피드"
            onClick={() => handleMove("/myfeeds")}
          />

          <MenuItem
            icon={<Bookmark size={20} strokeWidth={2.2} />}
            label="북마크"
            onClick={() => handleMove("/bookmark")}
          />



        </div>

        <div className={styles.otherTitle}>OTHER</div>

        <div className={styles.otherOptions}>
          <MenuItem
            icon={<User size={20} strokeWidth={2.2} />}
            label="마이 페이지"
            onClick={() => handleMove("/mypage")}
          />
          <MenuItem
            icon={<Settings size={20} strokeWidth={2.2} />}
            label="설정"
            onClick={() => handleMove("/settings")}
          />
          <MenuItem
            icon={<LogOut size={20} strokeWidth={2.2} />}
            label="로그아웃"
            onClick={handleLogout}
          />
        </div>
      </aside>
    </div>
  );
}