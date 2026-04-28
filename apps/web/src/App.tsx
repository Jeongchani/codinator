import { useEffect, useRef } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import Login from './pages/login/Login';
import PostUpload from './pages/post/PostUpload';
import RankingZone from './pages/ranking/RankingZone';
import RankingDetail from './pages/ranking/RankingDetail';
import Bookmark from './pages/bookmark/Bookmark';
import MyPage from './pages/auth/MyPage';
import MyPageEdit from './pages/auth/MyPageEdit';
import Search from './pages/search/Search';
import EvaluationZone from './pages/evaluation/EvaluationZone';
import EvaluationDetailFeedback from './pages/evaluation/EvaluationDetailFeedback';
import MyFeed from './pages/feed/MyFeed';
import MyPostDetailEdit from './pages/post/MyPostDetailEdit';
import Splash from './pages/splash/Splash';
import LoginSelect from './pages/login/LoginSelect';
import TestPage from './TestPage';
import AppLayout from './AppLayout';
import UserFeed from './pages/feed/UserFeed';
import OngoingEvaluationHistory from './pages/evaluation/OngoingEvaluationHistory';
import Settings from './pages/settings/Settings';
import PasswordReset from './pages/auth/PasswordReset';
import ForegroundPushCenter from './components/notifications/ForegroundPushCenter';

import { fetchMySettings, getAccessToken } from './lib/api';
import { applyThemeMode, getStoredThemeMode, saveAndApplyThemeMode } from './lib/theme';
import Signup from './pages/auth/Signup';

function ThemeSettingsHydrator() {
  const location = useLocation();
  const hydratedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const storedTheme = getStoredThemeMode();

    if (storedTheme) {
      applyThemeMode(storedTheme);
    }
  }, []);

  useEffect(() => {
    const accessToken = getAccessToken();

    if (!accessToken) {
      hydratedTokenRef.current = null;
      return;
    }

    if (hydratedTokenRef.current === accessToken) {
      return;
    }

    hydratedTokenRef.current = accessToken;

    let cancelled = false;

    const hydrateThemeFromServer = async () => {
      try {
        const settings = await fetchMySettings();

        if (cancelled) return;

        saveAndApplyThemeMode(settings.theme);
      } catch {
        if (cancelled) return;

        const storedTheme = getStoredThemeMode();

        if (storedTheme) {
          applyThemeMode(storedTheme);
        }
      }
    };

    void hydrateThemeFromServer();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  return null;
}

function AppRoutes() {
  const navigate = useNavigate();

  return (
    <>
      <ThemeSettingsHydrator />
      <ForegroundPushCenter />

      <Routes>
        <Route path="/" element={<Splash onFinish={() => navigate('/loginSelect')} />} />

        <Route path="/loginSelect" element={<LoginSelect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/myPage/edit" element={<MyPageEdit />} />
        <Route path="/passwordReset" element={<PasswordReset />} />

        <Route path="/evaluationDetailFeedback/:postId" element={<EvaluationDetailFeedback />} />

        <Route path="/rankingDetail/:postId" element={<RankingDetail />} />

        <Route path="/test" element={<TestPage />} />

        <Route element={<AppLayout />}>
          <Route path="/postUpload" element={<PostUpload />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/myPage" element={<MyPage />} />
          <Route path="/rankingZone" element={<RankingZone />} />
          <Route path="/evaluationZone" element={<EvaluationZone />} />
          <Route path="/ongoingEvaluationHistory" element={<OngoingEvaluationHistory />} />
          <Route path="/user/:userId/feed" element={<UserFeed />} />
          <Route path="/myFeed" element={<MyFeed />} />
          <Route path="/myPostDetailEdit/:postId" element={<MyPostDetailEdit />} />
          <Route path="/bookmark" element={<Bookmark />} />
          <Route path="/search" element={<Search />} />
        </Route>
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
