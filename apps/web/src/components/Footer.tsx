import { type ElementType, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Trophy,
  Bookmark,
  SquarePen,
  ClipboardCheck,
  Images,
} from "lucide-react";
import styles from "./Footer.module.css";

type FooterItem = {
  key: string;
  label: string;
  path: string;
  icon: ElementType;
};

const footerItems: FooterItem[] = [
  { key: "ranking", label: "랭킹존", path: "/rankingZone", icon: Trophy },
  { key: "evaluation", label: "평가존", path: "/evaluationZone", icon: ClipboardCheck },
  { key: "write", label: "글작성", path: "/postUpload", icon: SquarePen },
  { key: "myfeeds", label: "내피드", path: "/myFeed", icon: Images },
  { key: "bookmark", label: "북마크", path: "/bookmark", icon: Bookmark },
];

export default function Footer() {
  const navigate = useNavigate();
  const location = useLocation();

  const normalizePath = useCallback((path: string) => {
    return path.replace(/\/+$/, "") || "/";
  }, []);

  const getIsActive = useCallback(
    (path: string) => {
      const current = normalizePath(location.pathname);
      const target = normalizePath(path);
      return current === target || current.startsWith(`${target}/`);
    },
    [location.pathname, normalizePath]
  );

  return (
    <div className={styles.footerWrap}>
      <footer className={styles.footer} aria-label="하단 메뉴">
        <nav className={styles.inner}>
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
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  size={18}
                  strokeWidth={2}
                  className={`${styles.icon} ${isActive ? styles.iconActive : ""}`}
                />
                <span className={`${styles.label} ${isActive ? styles.labelActive : ""}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </footer>
    </div>
  );
}
