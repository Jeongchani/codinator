import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import Footer from './components/Footer';
import Login from './pages/auth/Login';
import MemberGuest from './pages/auth/MemberGuest';
import Signup from './pages/auth/Signup';
import Detail from './pages/look/Detail';
import Upload from './pages/post/Upload';
import RankingDetail from './pages/ranking/RankingDetail';
import RankingZone from './pages/ranking/RankingZone';
import Splash from './pages/splash/Splash';
import UserFeed from './pages/user/UserFeed.tsx';
import Evaluation from './pages/vote/Evaluation';
import Feedback from './pages/vote/Feedback';
import Test from './test';

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
      <Route path="/vote" element={<Evaluation />} />
      <Route path="/vote/feedback" element={<Feedback />} />
      <Route path="/user/:userId/feed" element={<UserFeed />} />

      <Route path="/detail" element={<Detail />} />
      <Route path="/test" element={<Test />} />
      <Route path="/Test" element={<Test />} />

      <Route path="/footer-preview" element={<Footer />} />
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
