// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Splash from './pages/splash/Splash';
import Login from './pages/auth/Login';
import Home from './pages/main/Home';
import RankingList from './pages/ranking/RankingList';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 기본 접속 시 스플래시(로딩) 화면 렌더링 */}
        <Route path="/" element={<Splash />} />
        {/* 1초 뒤 자동으로 넘어올 로그인 화면 */}
        <Route path="/login" element={<Login />} />
        {/* 메인 화면 라우터 추가 */}
        <Route path="/home" element={<Home />} />
        {/*  프로필 라우터 추가 */}
        <Route path="/ranking" element={<RankingList />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;