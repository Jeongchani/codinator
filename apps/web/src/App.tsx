import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Splash from './pages/splash/Splash';
import MemberGuest from './pages/auth/MemberGuest';
import Detail from './pages/look/Detail';
import Signup from './pages/auth/Signup';
import Login from './pages/auth/Login';
import RankingZone from './pages/ranking/RankingZone'; // 🔴 경로와 대소문자 확인
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
      <Route path="/detail" element={<Detail />} />
      <Route path="/test" element={<Test />} />
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