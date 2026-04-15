import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search } from 'lucide-react';
import styles from './Header.module.css';
import SideMenu from './SideMenu';

type HeaderProps = {
  title?: string;
};

export default function Header({ title = 'C:Dinator' }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleOpenMenu = () => {
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setMenuOpen(false);
  };

  const handleOpenSearch = () => {
    navigate('/search');
  };
  const handleGoRankingZone = () => {
    navigate('/rankingZone');
  };
  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <button
            type="button"
            className={styles.searchButton}
            onClick={handleOpenSearch}
            aria-label="검색 열기"
          >
            <Search size={23} strokeWidth={2.2} />
          </button>

          <h1
            className={styles.title}
            onClick={handleGoRankingZone}
            role="button"
            tabIndex={0}
            aria-label="랭킹존으로 이동"
          >
            {title}
          </h1>

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
