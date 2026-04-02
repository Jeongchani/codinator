import { useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  icon: React.ElementType;
};

const footerItems: FooterItem[] = [
  { key: "ranking", label: "랭킹존", path: "/rankingZone", icon: Trophy },
  { key: "evaluation", label: "평가존", path: "/evaluationZone", icon: ClipboardCheck },
  { key: "write", label: "글작성", path: "/postUpload", icon: SquarePen },
  { key: "myfeeds", label: "내피드", path: "/myFeeds", icon: Images },
  { key: "bookmark", label: "북마크", path: "/bookMark", icon: Bookmark }
];

export default function Footer() {
  const navigate = useNavigate();
  const location = useLocation();

  const innerRef = useRef<HTMLDivElement | null>(null);
  const activePillRef = useRef<HTMLSpanElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const prevXRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const moveTimerRef = useRef<number | null>(null);

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

  const updateIndicator = useCallback(() => {
    const innerEl = innerRef.current;
    const pillEl = activePillRef.current;

    if (!innerEl || !pillEl) return;

    const activeItem = footerItems.find((item) => getIsActive(item.path));
    if (!activeItem) return;

    const activeButton = buttonRefs.current[activeItem.key];
    if (!activeButton) return;

    const buttonRect = activeButton.getBoundingClientRect();
    const innerRect = innerEl.getBoundingClientRect();

    const nextX = buttonRect.left - innerRect.left;
    const nextWidth = buttonRect.width;
    const prevX = prevXRef.current;

    pillEl.classList.remove(
      styles.activePillMovingLeft,
      styles.activePillMovingRight,
      styles.activePillInstant
    );

    if (!initializedRef.current) {
      pillEl.classList.add(styles.activePillInstant);
      pillEl.style.width = `${nextWidth}px`;
      pillEl.style.transform = `translateX(${nextX}px)`;
      pillEl.classList.add(styles.activePillReady);

      prevXRef.current = nextX;
      initializedRef.current = true;
      return;
    }

    if (prevX !== null) {
      if (nextX > prevX) {
        pillEl.classList.add(styles.activePillMovingRight);
      } else if (nextX < prevX) {
        pillEl.classList.add(styles.activePillMovingLeft);
      }
    }

    if (moveTimerRef.current) {
      window.clearTimeout(moveTimerRef.current);
    }

    pillEl.style.width = `${nextWidth}px`;
    pillEl.style.transform = `translateX(${nextX}px)`;
    pillEl.classList.add(styles.activePillReady);

    moveTimerRef.current = window.setTimeout(() => {
      pillEl.classList.remove(
        styles.activePillMovingLeft,
        styles.activePillMovingRight
      );
    }, 120);

    prevXRef.current = nextX;
  }, [getIsActive]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      updateIndicator();
    });

    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [updateIndicator]);

  useEffect(() => {
    const handleResize = () => {
      updateIndicator();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (moveTimerRef.current) {
        window.clearTimeout(moveTimerRef.current);
      }
    };
  }, [updateIndicator]);

  return (
    <footer className={styles.footer}>
      <div ref={innerRef} className={styles.inner}>
        <span ref={activePillRef} className={styles.activePill} />

        {footerItems.map((item) => {
          const Icon = item.icon;
          const isActive = getIsActive(item.path);

          return (
            <button
              key={item.key}
              ref={(el) => {
                buttonRefs.current[item.key] = el;
              }}
              type="button"
              className={`${styles.menuButton} ${isActive ? styles.menuButtonActive : ""}`}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
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
      </div>
    </footer>
  );
}