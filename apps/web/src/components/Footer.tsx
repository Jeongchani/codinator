import { useNavigate, useLocation } from "react-router-dom";
import { Crown, Bookmark, SquarePen, Vote } from "lucide-react";
import styles from "./Footer.module.css";

type FooterItem = {
  key: string;
  label: string;
  path: string;
  icon: React.ElementType;
};

const footerItems: FooterItem[] = [
  { key: "ranking", label: "랭킹존", path: "/rankingzone", icon: Crown },
  { key: "bookmark", label: "북마크", path: "/bookmark", icon: Bookmark },
  { key: "write", label: "글 작성", path: "/postUpload", icon: SquarePen },
  { key: "evaluation", label: "평가존", path: "/evaluationzone", icon: Vote },
];

export default function Footer() {
  const navigate = useNavigate();
  const location = useLocation();

  const getIsActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        {footerItems.map((item) => {
          const Icon = item.icon;
          const isActive = getIsActive(item.path);

          return (
            <button
              key={item.key}
              type="button"
              className={`${styles.menuButton} ${isActive ? styles.menuButtonActive : ""}`}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
            >
              <span className={styles.activeBg} />
              <Icon
                size={16}
                strokeWidth={2}
                className={`${styles.icon} ${isActive ? styles.iconActive : ""}`}
              />
              <span className={`${styles.label} ${isActive ? styles.labelActive : ""}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </footer>
  );
}