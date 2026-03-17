// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Splash from './pages/Splash';
import Login from './pages/Login'; // 파일명이 소문자 login.tsx라면 거기에 맞게 import 해주세요!
import Main from './pages/Main';
import RankingProfile from './pages/RankingProfile';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 기본 접속 시 스플래시(로딩) 화면 렌더링 */}
        <Route path="/" element={<Splash />} />
        
        {/* 1초 뒤 자동으로 넘어올 로그인 화면 */}
        <Route path="/login" element={<Login />} />
        {/* 메인 화면 라우터 추가 */}
        <Route path="/main" element={<Main />} />
        {/* 🌟 프로필 라우터 추가 */}
        <Route path="/profile" element={<RankingProfile />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;