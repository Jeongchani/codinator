// src/pages/RankingProfile.tsx
import { useNavigate } from 'react-router-dom';
import styles from './ranking.module.css';

export default function RankingList() {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={styles.mobileWrapper}>
        
        {/* 🌟 상단 전체 배경 이미지 자리 (나중에 <img src="..." /> 로 변경) */}
        <div className={styles.topImageArea} />

        {/* 뒤로 가기 버튼 */}
        <div className={styles.backButton} onClick={() => navigate(-1)}>
          <div style={{ width: 12.18, height: 24.02, left: 0.83, top: -0.01, position: 'absolute', background: '#f5f5f5' }} />
          <div style={{ width: 13, height: 24, left: 10, top: 0, position: 'absolute', background: '#f5f5f5' }} />
        </div>

        {/* 왕관 및 프로필 아바타 */}
        <div className={styles.crownIconWrap}>
          <div className={styles.crownIconFill} />
        </div>
        
        {/* 🌟 프로필 동그라미 이미지 자리 (나중에 <img src="..." /> 로 변경) */}
        <div className={styles.profileAvatar} />

        <div className={styles.profileName}>LV. 오리자퍼</div>

        {/* 코디 설명 본문 */}
        <div className={styles.descText}>
          코디 컨셉 설명/키워드<br/>-<br/>-<br/>-
        </div>

        {/* 북마크(저장) 아이콘 */}
        <div className={styles.bookmarkIconWrap}>
          <div className={styles.bookmarkIconFill} />
        </div>

        {/* 구분선 1 */}
        <div className={styles.divider1} />

        {/* 🌟 긍정 평가 아이콘 자리 (나중에 <img src="..." /> 로 변경) */}
        <div className={styles.ratingIcon} />
        <div className={styles.ratingText}>89% 긍정적 평가</div>

        {/* 구분선 2 */}
        <div className={styles.divider2} />

        {/* 하단 네비게이션 바 */}
        <div className={styles.bottomNav}>
          <div className={styles.navIconWrap}>
            <div style={{ width: 39, height: 3.25, left: 0, top: 17.88, position: 'absolute', background: '#374957' }} />
            <div style={{ width: 39, height: 3.25, left: 0, top: 6.5, position: 'absolute', background: '#374957' }} />
            <div style={{ width: 39, height: 3.25, left: 0, top: 29.25, position: 'absolute', background: '#374957' }} />
          </div>
          <div className={styles.navIconCenterWrap}>
            <div style={{ width: 11.25, height: 18.8, left: 16.88, top: 26.25, position: 'absolute', background: '#374957' }} />
            <div style={{ width: 45, height: 44.46, left: 0, top: 0.6, position: 'absolute', background: '#374957' }} />
          </div>
          <div className={styles.navIconWrap}>
            <div style={{ width: 6.5, height: 6.5, left: 16.25, top: 0, position: 'absolute', background: '#374957' }} />
            <div style={{ width: 6.5, height: 6.5, left: 16.25, top: 16.25, position: 'absolute', background: '#374957' }} />
            <div style={{ width: 6.5, height: 6.5, left: 16.25, top: 32.5, position: 'absolute', background: '#374957' }} />
          </div>
        </div>

      </div>
    </div>
  );
}