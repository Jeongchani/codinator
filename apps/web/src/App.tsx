// src/App.tsx
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Splash from './pages/splash/Splash';
import MemberGuest from './pages/auth/MemberGuest';
import RankingList from './pages/ranking/RankingList';
import Detail from './pages/look/Detail';
import Signup from './pages/auth/Signup';
import Login from './pages/auth/Login';
import Test from './test';


// 1. 라우팅 로직을 별도의 컴포넌트로 분리 (useNavigate를 사용하기 위함)
function AppRoutes() {
  const navigate = useNavigate();
  return (
    <Routes>
      {/* 🔴 Splash에 onFinish 함수를 전달하여 1초 뒤 /login으로 이동하게 합니다 */}
      <Route path="/" element={<Splash onFinish={() => navigate('/member-guest')} />} />
      <Route path="/member-guest" element={<MemberGuest />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/rankingList" element={<RankingList />} />
      <Route path="/detail" element={<Detail />} />
      <Route path="/Test" element={<Test />} />
    </Routes>
  );
}

// 2. 최상위 App 컴포넌트
function App() {
  return (
    <BrowserRouter>
      {/* BrowserRouter가 AppRoutes를 감싸고 있어야 navigate가 작동합니다 */}
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;