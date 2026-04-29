import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import splashIntroImage from '../../assets/splash/splash-intro.png';
import splashUploadImage from '../../assets/splash/splash-upload.png';
import splashEvaluationImage from '../../assets/splash/splash-evaluation.png';

import styles from './Splash.module.css';

type SplashStep = 0 | 1 | 2;
type TransitionPhase = 'fadeIn' | 'fadeOut';

type SplashProps = {
  onFinish?: () => void;
  introDurationMs?: number;
};

type IntroScreenProps = {
  imageSrc: string;
  className?: string;
};

type LandingScreenProps = {
  pageLabel: string;
  title: ReactNode;
  subtitle: string;
  imageSrc: string;
  imageAlt: string;
  onSkip: () => void;
  onNext: () => void;
  className?: string;
};

const FADE_DURATION_MS = 280;

function cx(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

function IntroScreen({ imageSrc, className }: IntroScreenProps) {
  return (
    <section
      className={cx(styles.introScreen, className)}
      aria-label="C:Dinator 스플래시 화면"
    >
      <img
        src={imageSrc}
        alt="C:Dinator"
        className={styles.introImage}
        draggable={false}
      />
    </section>
  );
}

function LandingScreen({
  pageLabel,
  title,
  subtitle,
  imageSrc,
  imageAlt,
  onSkip,
  onNext,
  className,
}: LandingScreenProps) {
  return (
    <section
      className={cx(styles.landingScreen, className)}
      aria-label={`랜딩 화면 ${pageLabel}`}
    >
      <div className={styles.pageLabel}>{pageLabel}</div>

      <button type="button" className={styles.skipButton} onClick={onSkip}>
        건너뛰기
      </button>

      <div className={styles.textArea}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>

      <img
        src={imageSrc}
        alt={imageAlt}
        className={styles.landingImage}
        draggable={false}
      />

      <button type="button" className={styles.nextButton} onClick={onNext}>
        <span className={styles.nextText}>다음</span>
      </button>
    </section>
  );
}

export default function Splash({ onFinish, introDurationMs = 1200 }: SplashProps) {
  const navigate = useNavigate();

  const [step, setStep] = useState<SplashStep>(0);
  const [phase, setPhase] = useState<TransitionPhase>('fadeIn');

  const isTransitioningRef = useRef(false);
  const autoTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const unlockTimerRef = useRef<number | null>(null);

  const clearAutoTimer = useCallback(() => {
    if (autoTimerRef.current !== null) {
      window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  const clearFadeTimers = useCallback(() => {
    if (fadeTimerRef.current !== null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }

    if (unlockTimerRef.current !== null) {
      window.clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
  }, []);

  const finishSplash = useCallback(() => {
    if (onFinish) {
      onFinish();
      return;
    }

    navigate('/loginSelect');
  }, [navigate, onFinish]);

  const moveToStep = useCallback(
    (nextStep: SplashStep) => {
      if (isTransitioningRef.current) return;

      isTransitioningRef.current = true;

      clearAutoTimer();
      clearFadeTimers();

      setPhase('fadeOut');

      fadeTimerRef.current = window.setTimeout(() => {
        setStep(nextStep);
        setPhase('fadeIn');

        unlockTimerRef.current = window.setTimeout(() => {
          isTransitioningRef.current = false;
          fadeTimerRef.current = null;
          unlockTimerRef.current = null;
        }, FADE_DURATION_MS);
      }, FADE_DURATION_MS);
    },
    [clearAutoTimer, clearFadeTimers],
  );

  const finishWithFade = useCallback(() => {
    if (isTransitioningRef.current) return;

    isTransitioningRef.current = true;

    clearAutoTimer();
    clearFadeTimers();

    setPhase('fadeOut');

    fadeTimerRef.current = window.setTimeout(() => {
      finishSplash();
    }, FADE_DURATION_MS);
  }, [clearAutoTimer, clearFadeTimers, finishSplash]);

  const handleNext = useCallback(() => {
    if (step === 1) {
      moveToStep(2);
      return;
    }

    finishWithFade();
  }, [finishWithFade, moveToStep, step]);

  useEffect(() => {
    if (step !== 0) return;

    clearAutoTimer();

    autoTimerRef.current = window.setTimeout(() => {
      moveToStep(1);
    }, introDurationMs);

    return () => {
      clearAutoTimer();
    };
  }, [clearAutoTimer, introDurationMs, moveToStep, step]);

  useEffect(() => {
    return () => {
      clearAutoTimer();
      clearFadeTimers();
    };
  }, [clearAutoTimer, clearFadeTimers]);

  const transitionClassName = phase === 'fadeOut' ? styles.fadeOut : styles.fadeIn;

  return (
    <main className={styles.root}>
      {step === 0 ? (
        <IntroScreen
          imageSrc={splashIntroImage}
          className={transitionClassName}
        />
      ) : null}

      {step === 1 ? (
        <LandingScreen
          pageLabel="1/2"
          imageSrc={splashUploadImage}
          imageAlt="AI 블러 또는 직접 가리기로 얼굴을 숨기는 안내 이미지"
          onSkip={finishWithFade}
          onNext={handleNext}
          className={transitionClassName}
          title={
            <>
              <span className={styles.pinkText}>익명으로 편하게</span>
              <br />
              <span className={styles.blackText}>코디를 올려요!</span>
            </>
          }
          subtitle="AI 블러 또는 직접 가리기로 얼굴을 숨길 수 있어요"
        />
      ) : null}

      {step === 2 ? (
        <LandingScreen
          pageLabel="2/2"
          imageSrc={splashEvaluationImage}
          imageAlt="좋아요와 싫어요 평가 결과를 받는 안내 이미지"
          onSkip={finishWithFade}
          onNext={handleNext}
          className={transitionClassName}
          title={
            <>
              <span className={styles.tealText}>솔직한 평가</span>
              <span className={styles.blackText}>를</span>
              <br />
              <span className={styles.blackText}>받아보세요!</span>
            </>
          }
          subtitle="피드백과 평가로 내 코디의 장단점을 알 수 있어요"
        />
      ) : null}
    </main>
  );
}
