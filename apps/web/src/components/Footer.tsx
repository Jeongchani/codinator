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
  { key: "myfeeds", label: "내피드", path: "/myFeed", icon: Images },
  { key: "bookmark", label: "북마크", path: "/bookmark", icon: Bookmark },
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
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

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

  const hideIndicator = useCallback((resetPosition = false) => {
    const pillEl = activePillRef.current;
    if (!pillEl) return;

    pillEl.classList.remove(
      styles.activePillReady,
      styles.activePillMovingLeft,
      styles.activePillMovingRight
    );

    if (resetPosition) {
      pillEl.classList.add(styles.activePillInstant);
      pillEl.style.width = "0px";
      pillEl.style.transform = "translateX(0px)";
      prevXRef.current = null;
      initializedRef.current = false;
    }
  }, []);

  const updateIndicator = useCallback(() => {
    const pillEl = activePillRef.current;
    if (!pillEl) return;

    const activeItem = footerItems.find((item) => getIsActive(item.path));

    if (!activeItem) {
      hideIndicator(true);
      return;
    }

    const activeButton = buttonRefs.current[activeItem.key];
    if (!activeButton) {
      hideIndicator(true);
      return;
    }

    const PILL_INSET_X = 3;

    const rawX = activeButton.offsetLeft;
    const rawWidth = activeButton.offsetWidth;

    const nextX = Math.round(rawX + PILL_INSET_X);
    const nextWidth = Math.max(0, Math.round(rawWidth - PILL_INSET_X * 2));

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
  }, [getIsActive, hideIndicator]);

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
    };
  }, [updateIndicator]);

  useEffect(() => {
    if (!innerRef.current) return;

    resizeObserverRef.current = new ResizeObserver(() => {
      updateIndicator();
    });

    resizeObserverRef.current.observe(innerRef.current);

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
    };
  }, [updateIndicator]);

  useEffect(() => {
    return () => {
      if (moveTimerRef.current) {
        window.clearTimeout(moveTimerRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.footerWrap}>
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
    </div>
  );
}