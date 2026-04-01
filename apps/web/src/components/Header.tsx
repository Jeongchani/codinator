import { useState } from "react";
import { Menu } from "lucide-react";
import SideMenu from "../components/SideMenu";
import styles from "./Header.module.css";

type HeaderProps = {
  title?: string;
};

export default function Header({
  title = "C:Dinator",
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleOpenMenu = () => {
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setMenuOpen(false);
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <div className={styles.leftSpace} />

          <h1 className={styles.title}>{title}</h1>

          <button
            type="button"
            className={styles.menuButton}
            onClick={handleOpenMenu}
            aria-label="메뉴 열기"
          >
            <Menu size={25} strokeWidth={2.2} />
          </button>
        </div>
      </header>

      <SideMenu isOpen={menuOpen} onClose={handleCloseMenu} />
    </>
  );
}