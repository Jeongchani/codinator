// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 기본 경로('/')로 접속하면 Login 컴포넌트를 보여줍니다 */}
        <Route path="/" element={<Login />} />
        
        {/* 나중에 다른 페이지가 생기면 아래처럼 추가하시면 됩니다! */}
        {/* <Route path="/home" element={<Home />} /> */}
        {/* <Route path="/guest" element={<GuestPage />} /> */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;