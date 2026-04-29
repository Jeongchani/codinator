import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import {
  clearAuthTokens,
  fetchMyProfile,
  getAccessToken,
  isAdminRole,
  isAuthError,
} from '../lib/api';

type RequireAdminRouteProps = {
  children: ReactNode;
};

type GuardState = 'checking' | 'allowed' | 'login-required' | 'forbidden';

export default function RequireAdminRoute({ children }: RequireAdminRouteProps) {
  const location = useLocation();
  const [guardState, setGuardState] = useState<GuardState>('checking');

  useEffect(() => {
    let cancelled = false;

    const checkAdminRole = async () => {
      if (!getAccessToken()) {
        setGuardState('login-required');
        return;
      }

      setGuardState('checking');

      try {
        const profile = await fetchMyProfile();

        if (cancelled) return;

        setGuardState(isAdminRole(profile.role) ? 'allowed' : 'forbidden');
      } catch (error) {
        if (cancelled) return;

        const message = error instanceof Error ? error.message : '';

        if (isAuthError(message)) {
          clearAuthTokens();
          setGuardState('login-required');
          return;
        }

        setGuardState('forbidden');
      }
    };

    void checkAdminRole();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (guardState === 'checking') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f7fafc',
          color: '#1a202c',
          fontFamily: "'Pretendard', 'Inter', -apple-system, sans-serif",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        관리자 권한 확인 중...
      </div>
    );
  }

  if (guardState === 'login-required') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (guardState === 'forbidden') {
    return <Navigate to="/rankingZone" replace />;
  }

  return <>{children}</>;
}
