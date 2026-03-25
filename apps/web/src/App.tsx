import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import MemberGuest from './pages/auth/MemberGuest';
import Signup from './pages/auth/Signup';
import Upload from './pages/post/Upload';
import RankingDetail from './pages/ranking/RankingDetail';
import RankingZone from './pages/ranking/RankingZone';
import Splash from './pages/splash/Splash';
import UserFeed from './pages/user/UserFeed';
import EvaluationZone from './pages/Evaluation/EvaluationZone';
import Test from './test';
import EvaluationDetail from './pages/Evaluation/EvaluationDetail';
import EvaluationFeedback from './pages/Evaluation/EvaluationFeedback';

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

      <Route path="/post/write" element={<Upload />} />
      <Route path="/user/:userId/feed" element={<UserFeed />} />
      <Route path="/user/:userId/feed/:postId" element={<UserFeed />} />

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
