import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import styles from "./components.module.css";

type FooterItem = {
  key: string;
  label: string;
  to: string;
};

function RankingIcon({ active = false }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M9.99702 15.6622L15.1272 18.48C15.1872 18.4956 15.2398 18.4878 15.2849 18.4567C15.33 18.4257 15.3452 18.3786 15.3303 18.3155L14.3626 12.3506L18.5027 8.12377C18.5479 8.07668 18.563 8.02583 18.5481 7.97123C18.5332 7.91662 18.4958 7.8813 18.4358 7.86527L12.6979 6.99661L10.1324 1.572C10.1021 1.50938 10.057 1.47808 9.99702 1.47808C9.93701 1.47808 9.89189 1.50938 9.86165 1.572L7.29618 6.99661L1.55825 7.86527C1.49825 7.8808 1.46081 7.91612 1.44593 7.97123C1.43105 8.02633 1.44617 8.07718 1.49129 8.12377L5.63147 12.3506L4.64142 18.3155C4.64142 18.3781 4.66399 18.4252 4.70911 18.4567C4.75423 18.4883 4.80679 18.4961 4.86679 18.48L9.99702 15.6622ZM5.54218 19.7951C5.25705 19.9519 4.96832 20.0185 4.67599 19.9949C4.38365 19.9714 4.11364 19.8657 3.86595 19.6778C3.61826 19.49 3.43825 19.2513 3.32593 18.9617C3.2136 18.6722 3.17976 18.3708 3.2244 18.0577L4.0798 12.8683L0.479644 9.20508C0.254514 8.98566 0.108348 8.72341 0.0411447 8.41833C-0.0260583 8.11325 -0.0109376 7.80791 0.0865066 7.50233C0.183951 7.19675 0.345238 6.94627 0.570368 6.75089C0.795497 6.55552 1.05807 6.43429 1.35808 6.3872L6.35366 5.63576L8.58144 0.916002C8.71632 0.618433 8.91145 0.3915 9.16682 0.235202C9.42219 0.078903 9.69964 0.000503342 9.99918 2.38551e-06C10.2987 -0.000498571 10.5762 0.0779011 10.8315 0.235202C11.0869 0.392502 11.282 0.619435 11.4169 0.916002L13.6447 5.63576L18.6403 6.3872C18.9403 6.43429 19.2065 6.55552 19.4388 6.75089C19.6711 6.94627 19.8324 7.19675 19.9226 7.50233C20.0129 7.80791 20.0242 8.11325 19.9565 8.41833C19.8888 8.72341 19.7426 8.98566 19.518 9.20508L15.9178 12.8683L16.7732 18.0577C16.8184 18.3708 16.7845 18.6722 16.6717 18.9617C16.5589 19.2513 16.3789 19.49 16.1317 19.6778C15.8845 19.8657 15.6145 19.9714 15.3216 19.9949C15.0288 20.0185 14.7401 19.9599 14.4554 19.8191L9.9999 17.3536L5.54218 19.7951Z"
        fill={active ? "#111111" : "none"}
        stroke="#111111"
        strokeWidth={active ? "0" : "0"}
      />
    </svg>
  );
}

function BookmarkIcon({ active = false }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M14.4404 0.599609C17.1124 0.599874 19.4004 3.07029 19.4004 6.28125C19.4004 7.56031 19.2182 8.74031 18.9033 9.83398L18.9023 9.83789C17.3879 15.2222 12.6939 18.4639 10.4053 19.3389L10.3984 19.3408C10.3201 19.3718 10.176 19.4004 10 19.4004C9.82404 19.4004 9.67994 19.3718 9.60156 19.3408L9.59473 19.3389L9.37305 19.249C7.0156 18.2584 2.56477 15.0539 1.09766 9.83789L1.09668 9.83398L0.984375 9.41992C0.738639 8.44389 0.599638 7.40044 0.599609 6.28125C0.599609 3.07029 2.88756 0.599874 5.55957 0.599609C7.1412 0.599609 8.58599 1.46373 9.50098 2.83789L10 3.58789L10.499 2.83789C11.414 1.46373 12.8588 0.599609 14.4404 0.599609Z"
        fill={active ? "#111111" : "none"}
        stroke="#111111"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function HomeIcon({ active = false }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 23" fill="none" aria-hidden="true">
      <path
        d="M11 1.30176L1 9.63509V21.3018H7.66667V14.6351H14.3333V21.3018H21V9.63509L11 1.30176Z"
        fill={active ? "#111111" : "none"}
        stroke="#111111"
        strokeWidth="2"
      />
    </svg>
  );
}

function WriteIcon({ active = false }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M3.88687 13.1444L7.67625 15.3319L12.0512 7.75375L8.26187 5.56625L3.88687 13.1444ZM3.41812 14.3163L4.0625 17.2069L6.89438 16.3081L3.41812 14.3163ZM8.88687 4.4725L12.6762 6.66L13.7894 4.74562L10 2.55812L8.88687 4.4725ZM2.03125 13.8475L9.53125 0.859375L15.4881 4.29688L7.98813 17.285L3.14438 18.8087L2.03125 13.8475ZM9.53125 18.8087V17.5587H18.2812V18.8087H9.53125Z"
        fill="#111111"
        opacity={active ? "1" : "0.92"}
      />
    </svg>
  );
}

function EvaluationIcon({ active = false }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M9.99993 2.50016C9.63534 2.51307 9.33576 2.63682 9.10118 2.87141C8.86659 3.10599 8.74284 3.39891 8.72993 3.75016V13.8477L5.35118 11.152C5.02576 10.8916 4.66451 10.7549 4.26743 10.742C3.87034 10.7291 3.49597 10.8397 3.1443 11.0739C2.9618 11.2302 2.85118 11.4256 2.81243 11.6602C2.77368 11.8947 2.82576 12.1095 2.96868 12.3045L6.50368 16.992C6.62076 17.1612 6.76722 17.2881 6.94305 17.3727C7.11889 17.4572 7.30451 17.4995 7.49993 17.4995H17.4999V11.2302C17.4999 10.9568 17.4185 10.7093 17.2556 10.4877C17.0926 10.266 16.8745 10.1162 16.6012 10.0383L12.5774 8.82703C12.1737 8.69661 11.8514 8.47203 11.6106 8.15328C11.3697 7.83453 11.2493 7.46016 11.2493 7.03016V3.74891C11.2364 3.39724 11.1126 3.10432 10.8781 2.87016C10.6435 2.63599 10.3506 2.51224 9.9993 2.49891L9.99993 2.50016ZM7.0118 10.8789L7.48055 11.2502V3.75016C7.48055 3.29432 7.58805 2.8712 7.80305 2.48078C8.01805 2.09036 8.32409 1.77786 8.72118 1.54328C9.11826 1.3087 9.54138 1.19141 9.99055 1.19141C10.4397 1.19141 10.8628 1.3087 11.2599 1.54328C11.657 1.77786 11.9631 2.09036 12.1781 2.48078C12.3931 2.8712 12.5006 3.29432 12.5006 3.75016V7.03141C12.5006 7.17474 12.5397 7.30161 12.6181 7.41203C12.6964 7.52245 12.807 7.59724 12.9499 7.63641L16.9737 8.84766C17.5074 9.01682 17.9339 9.31641 18.2531 9.74641C18.5722 10.1764 18.7383 10.6712 18.7512 11.2308V17.5002C18.7383 17.8518 18.6145 18.1447 18.3799 18.3789C18.1453 18.6131 17.8524 18.7368 17.5012 18.7502H7.50118C7.09743 18.7502 6.72305 18.6622 6.37805 18.4864C6.03305 18.3106 5.74326 18.0664 5.50868 17.7539L1.97368 13.047C1.80451 12.8124 1.68409 12.5554 1.61243 12.2758C1.54076 11.9962 1.53097 11.7097 1.58305 11.4164C1.63514 11.1231 1.7393 10.8562 1.89555 10.6158C2.0518 10.3754 2.25368 10.1768 2.50118 10.0202C3.07409 9.64266 3.6893 9.47016 4.3468 9.50266C5.0043 9.53516 5.59993 9.75974 6.13368 10.1764L7.0118 10.8789Z"
        fill="#111111"
        opacity={active ? "1" : "0.92"}
      />
    </svg>
  );
}

const Footer: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const items: FooterItem[] = [
    { key: "ranking", label: "랭킹존", to: "/rankingZone" },
    { key: "bookmark", label: "북마크", to: "/bookmark" },
    { key: "home", label: "홈", to: "/rankingZone" },
    { key: "write", label: "글 작성", to: "/postUpload" },
    { key: "evaluation", label: "평가존", to: "/evaluationZone" },
  ];

  const isActivePath = (to: string) => {
    if (to === "/rankingZone") {
      return (
        location.pathname === "/rankingZone" ||
        location.pathname.startsWith("/rankingDetail")
      );
    }

    if (to === "/evaluationZone") {
      return (
        location.pathname === "/evaluationZone" ||
        location.pathname.startsWith("/evaluationDetail")
      );
    }

    if (to === "/postUpload") {
      return location.pathname === "/postUpload";
    }

    if (to === "/bookmark") {
      return location.pathname.startsWith("/bookmark");
    }

    return location.pathname === to;
  };

  return (
    <div className={styles.footerWrap}>
      <nav className={styles.footerLens} aria-label="하단 네비게이션">
        <div className={styles.glassBase} />
        <div className={styles.lensHighlightTop} />
        <div className={styles.lensHighlightLeft} />
        <div className={styles.lensHighlightRight} />
        <div className={styles.lensCaustic} />
        <div className={styles.lensInnerShadow} />

        <div className={styles.navRow}>
          {items.map((item) => {
            const active = isActivePath(item.to);

            return (
              <NavLink
                key={item.key}
                to={item.to}
                className={styles.navItem}
                onClick={(e) => {
                  if (item.to === "/bookmark") {
                    e.preventDefault();
                    navigate("/bookmark");
                  }
                }}
              >
                <div className={styles.iconBox}>
                  {item.key === "ranking" && <RankingIcon active={active} />}
                  {item.key === "bookmark" && <BookmarkIcon active={active} />}
                  {item.key === "home" && <HomeIcon active={active} />}
                  {item.key === "write" && <WriteIcon active={active} />}
                  {item.key === "evaluation" && <EvaluationIcon active={active} />}
                </div>

                <span className={`${styles.label} ${active ? styles.activeLabel : ""}`}>
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default Footer;