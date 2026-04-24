import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import Login from './pages/login/Login';
import Signup from './pages/auth/Signup';
import PostUpload from './pages/post/PostUpload';
import RankingZone from './pages/ranking/RankingZone';
import Splash from './pages/splash/Splash';
import MyFeed from './pages/feed/MyFeed';
import MyPostDetailEdit from './pages/post/MyPostDetailEdit';
import LoginSelect from './pages/login/LoginSelect';
import AppLayout from './AppLayout';
import TestPage from './TestPage';
import Bookmark from './pages/bookmark/Bookmark';
import MyPage from './pages/auth/MyPage';
import MyPageEdit from './pages/auth/MyPageEdit';
import Search from './pages/search/Search';
import EvaluationZone from './pages/evaluation/EvaluationZone';
import EvaluationDetailFeedback from './pages/evaluation/EvaluationDetailFeedback';
import RankingDetail from './pages/ranking/RankingDetail';
import UserFeed from './pages/feed/UserFeed';
import OngoingEvaluationHistory from './pages/evaluation/OngoingEvaluationHistory';
import Settings from './pages/settings/Settings';
import { fetchMySettings, getAccessToken } from './lib/api';
import { applyThemeMode, saveThemeMode } from './lib/theme';

function ThemeSync() {
  useEffect(() => {
    let cancelled = false;

    const syncTheme = async () => {
      if (!getAccessToken()) {
        return;
      }

      try {
        const settings = await fetchMySettings();
        if (cancelled) return;

        saveThemeMode(settings.theme);
        applyThemeMode(settings.theme);
      } catch (error) {
        console.warn('설정 테마 동기화 실패:', error);
      }
    };

    void syncTheme();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

function AppRoutes() {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/" element={<Splash onFinish={() => navigate('/loginSelect')} />} />
      <Route path="/loginSelect" element={<LoginSelect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/evaluationZone" element={<EvaluationZone />} />
      <Route path="/evaluationDetailFeedback/:postId" element={<EvaluationDetailFeedback />} />
      <Route path="/postUpload" element={<PostUpload />} />
      <Route path="/rankingDetail/:postId" element={<RankingDetail />} />
      <Route path="/myPage/edit" element={<MyPageEdit />} />
      <Route path="/ongoingEvaluationHistory" element={<OngoingEvaluationHistory />} />

      <Route path="/test" element={<TestPage />} />

      <Route element={<AppLayout />}>
        <Route path="/settings" element={<Settings />} />
        <Route path="/myPage" element={<MyPage />} />
        <Route path="/rankingZone" element={<RankingZone />} />
        <Route path="/user/:userId/feed" element={<UserFeed />} />
        <Route path="/myFeed" element={<MyFeed />} />
        <Route path="/myPostDetailEdit/:postId" element={<MyPostDetailEdit />} />
        <Route path="/bookmark" element={<Bookmark />} />
        <Route path="/search" element={<Search />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeSync />
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
