import { type KeyboardEvent, type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Menu, Search } from 'lucide-react';
import styles from './Header.module.css';
import SideMenu from './SideMenu';

type HeaderAction = 'none' | 'back' | 'search' | 'menu' | 'text' | 'custom';

type HeaderProps = {
  /** 가운데 타이틀입니다. 랭킹존 기본값은 C:Dinator 입니다. */
  title?: string;

  /** 왼쪽 액션입니다. 기본값은 검색 버튼입니다. */
  leftAction?: HeaderAction;

  /** 오른쪽 액션입니다. 기본값은 사이드메뉴 버튼입니다. */
  rightAction?: HeaderAction;

  /** leftAction이 custom일 때 렌더링할 요소입니다. */
  leftSlot?: ReactNode;

  /** rightAction이 custom일 때 렌더링할 요소입니다. */
  rightSlot?: ReactNode;

  /** rightAction이 text일 때 표시할 글자입니다. 예: 선택, 전체선택 */
  rightText?: string;

  /** 접근성 라벨입니다. */
  leftAriaLabel?: string;
  rightAriaLabel?: string;

  /** 뒤로가기 액션을 직접 제어할 때 사용합니다. */
  onBack?: () => void;

  /** 뒤로가기 시 특정 경로로 이동해야 할 때 사용합니다. */
  backTo?: string;

  /** 검색 액션을 직접 제어할 때 사용합니다. */
  onSearch?: () => void;

  /** 검색 버튼 기본 이동 경로입니다. */
  searchTo?: string;

  /** 메뉴 버튼을 직접 제어할 때 사용합니다. 지정하지 않으면 SideMenu를 엽니다. */
  onMenuClick?: () => void;

  /** 텍스트 버튼 클릭 핸들러입니다. */
  onRightTextClick?: () => void;

  /** 오른쪽 액션 전체를 직접 제어할 때 사용합니다. */
  onRightClick?: () => void;

  /** 타이틀 클릭 핸들러입니다. */
  onTitleClick?: () => void;

  /** 타이틀 클릭 시 이동 경로입니다. 기본 타이틀 C:Dinator에서는 /rankingZone으로 이동합니다. */
  titleTo?: string;

  /** 타이틀 클릭 가능 여부를 강제로 지정합니다. */
  titleClickable?: boolean;

  /** 오른쪽 텍스트 버튼 비활성화 여부입니다. */
  rightDisabled?: boolean;

  /** 오른쪽 텍스트 버튼을 누른 상태처럼 보이게 할 때 사용합니다. */
  rightPressed?: boolean;

  /** 오른쪽 텍스트 버튼 터치/마우스 누름 시작 핸들러입니다. */
  onRightPressStart?: () => void;

  /** 오른쪽 텍스트 버튼 터치/마우스 누름 종료 핸들러입니다. */
  onRightPressEnd?: () => void;

  /** 사이드메뉴 렌더링 여부입니다. */
  showSideMenu?: boolean;

  /** 추가 클래스가 필요할 때 사용합니다. */
  className?: string;
};

const DEFAULT_TITLE = 'C:Dinator';
const DEFAULT_SEARCH_TO = '/search';
const DEFAULT_TITLE_TO = '/rankingZone';

export default function Header({
  title = DEFAULT_TITLE,
  leftAction = 'search',
  rightAction = 'menu',
  leftSlot,
  rightSlot,
  rightText,
  leftAriaLabel,
  rightAriaLabel,
  onBack,
  backTo,
  onSearch,
  searchTo = DEFAULT_SEARCH_TO,
  onMenuClick,
  onRightTextClick,
  onRightClick,
  onTitleClick,
  titleTo,
  titleClickable,
  rightDisabled = false,
  rightPressed = false,
  onRightPressStart,
  onRightPressEnd,
  showSideMenu = true,
  className = '',
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const resolvedTitleTo = titleTo ?? (title === DEFAULT_TITLE ? DEFAULT_TITLE_TO : undefined);
  const isTitleClickable = titleClickable ?? Boolean(onTitleClick || resolvedTitleTo);
  const shouldRenderSideMenu = showSideMenu && (leftAction === 'menu' || rightAction === 'menu');

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    if (backTo) {
      navigate(backTo);
      return;
    }

    navigate(-1);
  };

  const handleSearch = () => {
    if (onSearch) {
      onSearch();
      return;
    }

    navigate(searchTo);
  };

  const handleMenu = () => {
    if (onMenuClick) {
      onMenuClick();
      return;
    }

    setMenuOpen(true);
  };

  const handleTitleClick = () => {
    if (!isTitleClickable) {
      return;
    }

    if (onTitleClick) {
      onTitleClick();
      return;
    }

    if (resolvedTitleTo) {
      navigate(resolvedTitleTo);
    }
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLHeadingElement>) => {
    if (!isTitleClickable) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTitleClick();
    }
  };

  const getActionLabel = (action: HeaderAction, side: 'left' | 'right') => {
    if (side === 'left' && leftAriaLabel) {
      return leftAriaLabel;
    }

    if (side === 'right' && rightAriaLabel) {
      return rightAriaLabel;
    }

    if (action === 'back') {
      return '뒤로가기';
    }

    if (action === 'search') {
      return '검색 열기';
    }

    if (action === 'menu') {
      return '사이드 메뉴 열기';
    }

    if (action === 'text') {
      return rightText || '헤더 버튼';
    }

    return `${side === 'left' ? '왼쪽' : '오른쪽'} 헤더 버튼`;
  };

  const renderAction = (action: HeaderAction, side: 'left' | 'right') => {
    if (action === 'none') {
      return null;
    }

    const positionClassName = side === 'left' ? styles.leftButton : styles.rightButton;

    if (action === 'custom') {
      const slot = side === 'left' ? leftSlot : rightSlot;

      if (!slot) {
        return null;
      }

      return <div className={`${styles.customSlot} ${positionClassName}`}>{slot}</div>;
    }

    if (action === 'text') {
      return (
        <button
          type="button"
          className={`${styles.textButton} ${positionClassName} ${
            rightPressed ? styles.textButtonPressed : ''
          }`}
          onClick={onRightTextClick ?? onRightClick}
          onTouchStart={onRightPressStart}
          onTouchEnd={onRightPressEnd}
          onTouchCancel={onRightPressEnd}
          onMouseDown={onRightPressStart}
          onMouseUp={onRightPressEnd}
          onMouseLeave={onRightPressEnd}
          disabled={rightDisabled}
          aria-label={getActionLabel(action, side)}
        >
          {rightText}
        </button>
      );
    }

    const handleClick = () => {
      if (side === 'right' && onRightClick) {
        onRightClick();
        return;
      }

      if (action === 'back') {
        handleBack();
        return;
      }

      if (action === 'search') {
        handleSearch();
        return;
      }

      if (action === 'menu') {
        handleMenu();
      }
    };

    return (
      <button
        type="button"
        className={`${styles.iconButton} ${positionClassName}`}
        onClick={handleClick}
        aria-label={getActionLabel(action, side)}
      >
        {action === 'back' ? <ChevronLeft size={23} strokeWidth={2.2} /> : null}
        {action === 'search' ? <Search size={23} strokeWidth={2.2} /> : null}
        {action === 'menu' ? <Menu size={25} strokeWidth={2.2} /> : null}
      </button>
    );
  };

  return (
    <>
      <header className={`${styles.header} ${className}`}>
        <div className={styles.inner}>
          {renderAction(leftAction, 'left')}

          <h1
            className={`${styles.title} ${isTitleClickable ? styles.titleClickable : ''}`}
            onClick={handleTitleClick}
            onKeyDown={handleTitleKeyDown}
            role={isTitleClickable ? 'button' : undefined}
            tabIndex={isTitleClickable ? 0 : undefined}
            aria-label={isTitleClickable ? `${title} 이동` : undefined}
          >
            {title}
          </h1>

          {renderAction(rightAction, 'right')}
        </div>
      </header>

      {shouldRenderSideMenu ? <SideMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} /> : null}
    </>
  );
}
