import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './components.module.css';

const Footer: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isRankingRoute = location.pathname.startsWith('/ranking');
  const isEvaluationRoute = location.pathname.startsWith('/evaluation');

  return (
    <div className={styles.whiteBackground}>
      <div className={styles.footerContainer}>
        <div className={styles.svgWrapper}>
          <svg width="375" height="95" viewBox="0 0 375 95" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M375 95H0V0H96.8516C134.757 0.000234752 146.008 54 187.559 54C229.109 53.9997 241.231 0.000294547 278.407 0H375V95Z"
              fill="#111111"
            />
          </svg>
        </div>

        <div className={styles.navItem} onClick={() => navigate('/rankingZone')}>
          <div className={styles.iconBox}>
            <RankingIcon color={isRankingRoute ? '#FFFFFF' : '#666666'} />
          </div>
          <span className={`${styles.navText} ${isRankingRoute ? styles.activeText : ''}`}>랭킹</span>
        </div>

        <div className={styles.addBtnWrapper} onClick={() => navigate('/postUpload')}>
          <div className={styles.addBtnCircle}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M16 24H8V16H0V8H8V0H16V8H24V16H16V24Z" fill="#111111" />
            </svg>
          </div>
        </div>

        <div className={styles.navItem} onClick={() => navigate('/evaluationZone')}>
          <div className={styles.iconBox}>
            <VoteIcon color={isEvaluationRoute ? '#FFFFFF' : '#666666'} />
          </div>
          <span className={`${styles.navText} ${isEvaluationRoute ? styles.activeText : ''}`}>평가</span>
        </div>
      </div>
    </div>
  );
};

const RankingIcon = ({ color }: { color: string }) => (
  <svg width="25" height="25" viewBox="0 0 25 25" fill="none">
    <path d="M18.5156 1.79687C18.3594 1.64062 18.2031 1.5625 17.9688 1.5625H7.03125C6.79688 1.5625 6.64063 1.64062 6.48438 1.79687C6.32813 1.95312 6.25 2.10938 6.25 2.34375V9.375C6.32812 11.1719 6.875 12.6563 8.04688 13.8281C9.21875 15 10.7031 15.625 12.5 15.625C14.2969 15.5469 15.7813 15 16.9531 13.8281C18.125 12.6563 18.75 11.1719 18.75 9.375V2.34375Z" fill={color} />
    <path d="M22.4219 4.92188C22.2656 4.76563 22.1094 4.6875 21.875 4.6875H17.1875V12.5C18.75 12.5 20 11.9531 21.0938 10.9375C22.0312 10 22.5781 8.20312 22.6562 5.46875V5.3125C22.5781 5.07813 22.4219 4.92188Z" fill={color} />
    <path d="M3.125 4.6875C2.89062 4.6875 2.73437 4.76563 2.57812 4.92188C2.42187 5.07813 2.34375 5.3125 2.34375 5.46875C2.42188 8.125 2.96875 10 3.90625 10.9375C4.92188 11.9531 6.25 12.5 7.8125 12.5V4.6875H3.125Z" fill={color} />
  </svg>
);

const VoteIcon = ({ color }: { color: string }) => (
  <svg width="25" height="25" viewBox="0 0 25 25" fill="none">
    <path d="M3.125 9.375V20.3125H21.875V9.375H3.125ZM2.34375 7.8125H22.6562V21.875H2.34375V7.8125ZM3.90625 4.6875H21.0938V6.25H3.90625V4.6875ZM6.25 1.5625H18.75V3.125H6.25V1.5625Z" fill={color} />
  </svg>
);

export default Footer;
