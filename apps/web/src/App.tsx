import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import MemberGuest from './pages/auth/MemberGuest';
import Signup from './pages/auth/Signup';
import Upload from './pages/post/Upload';
import RankingDetail from './pages/ranking/RankingDetail';
import RankingZone from './pages/ranking/RankingZone';
import Splash from './pages/splash/Splash';
import EvaluationZone from './pages/evaluation/EvaluationZone';
import Test from './test';
import EvaluationDetail from './pages/evaluation/EvaluationDetail';
import EvaluationFeedback from './pages/evaluation/EvaluationFeedback';
import UserFeedDetail from './pages/feeds/UserFeedDetail';
import MyFeeds from './pages/feeds/MyFeeds';
import MyFeedDetail from './pages/feeds/MyFeedDetail';
import MyFeedEdit from './pages/feeds/MyFeedEdit';
import UserFeeds from './pages/feeds/UserFeeds';

function AppRoutes() {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/" element={<Splash onFinish={() => navigate('/member-guest')} />} />
      <Route path="/member-guest" element={<MemberGuest />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/rankingZone" element={<RankingZone />} />
      <Route path="/ranking-detail/:postId" element={<RankingDetail />} />

      <Route path="/evaluationZone" element={<EvaluationZone />} />
      <Route path="/evaluation-feedback/:postId" element={<EvaluationFeedback />} />
      <Route path="/evaluation-detail/:postId" element={<EvaluationDetail />} />

      <Route path="/post-upload" element={<Upload />} />
      <Route path="/user/:userId/feed" element={<UserFeeds />} />
      <Route path="/user/:userId/feed/:postId" element={<UserFeedDetail />} />

      <Route path="/my-feeds" element={<MyFeeds />} />
      <Route path="/my-feed-detail" element={<MyFeedDetail />} />
      <Route path="/my-feed-edit" element={<MyFeedEdit />} />

      <Route path="/Test" element={<Test />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
