import { Menu } from "lucide-react";
import styles from "./Header.module.css";

type HeaderProps = {
  title?: string;
  onMenuClick?: () => void;
};

export default function Header({
  title = "C:Dinator",
  onMenuClick,
}: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.leftSpace} />

        <h1 className={styles.title}>{title}</h1>

        <button
          type="button"
          className={styles.menuButton}
          onClick={onMenuClick}
          aria-label="메뉴 열기"
        >
          <Menu size={25} strokeWidth={2.2} />
        </button>
      </div>
    </header>
  );
}