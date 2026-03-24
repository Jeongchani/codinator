import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import MemberGuest from './pages/auth/MemberGuest';
import Signup from './pages/auth/Signup';
import Upload from './pages/post/Upload';
import RankingDetail from './pages/ranking/RankingDetail';
import RankingZone from './pages/ranking/RankingZone';
import Splash from './pages/splash/Splash';
import UserFeed from './pages/user/UserFeed';
import EvaluationDetail1 from './pages/Evaluation/EvaluationDetail1';
import EvaluationDetail2 from './pages/Evaluation/EvaluationDetail2';
import EvaluationZone from './pages/Evaluation/EvaluationZone';
import Test from './Test';

function AppRoutes() {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/" element={<Splash onFinish={() => navigate('/member-guest')} />} />
      <Route path="/member-guest" element={<MemberGuest />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/rankingZone" element={<RankingZone />} />
      <Route path="/rankingList" element={<RankingZone />} />
      <Route path="/ranking-detail/:postId" element={<RankingDetail />} />

      <Route path="/post/write" element={<Upload />} />
      <Route path="/evaluationZone" element={<EvaluationZone />} />
      <Route path="/user/:userId/feed" element={<UserFeed />} />

      <Route path="/evaluation-detail1" element={<EvaluationDetail1 />} />
      <Route path="/evaluation-detail2" element={<EvaluationDetail2 />} />

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
