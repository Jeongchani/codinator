import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import Login from "./pages/login/Login";
import Signup from "./pages/auth/Signup";
import PostUpload from "./pages/post/PostUpload";
import RankingZone from "./pages/ranking/RankingZone";
import Splash from "./pages/splash/Splash";
import MyFeed from "./pages/feed/MyFeed";
import MyPostDetailEdit from "./pages/post/MyPostDetailEdit";
import LoginSelect from "./pages/login/LoginSelect";
import AppLayout from "./AppLayout";
import TestPage from "./TestPage";
import Bookmark from "./pages/bookmark/Bookmark";
import MyPage from "./pages/auth/MyPage";
import Search from "./pages/search/Search";
import EvaluationZone from "./pages/evaluation/EvaluationZone";
import EvaluationDetailFeedback from "./pages/evaluation/EvaluationDetailFeedback";
import RankingDetail from "./pages/ranking/RankingDetail";
import UserFeed from "./pages/feed/UserFeed";

function AppRoutes() {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/" element={<Splash onFinish={() => navigate("/loginSelect")} />} />
      <Route path="/loginSelect" element={<LoginSelect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/evaluationZone" element={<EvaluationZone/>} />
      <Route path="/evaluationDetailFeedback/:postId" element={<EvaluationDetailFeedback />} />
      <Route path="/postUpload" element={<PostUpload />} />
      <Route path="/rankingDetail/:postId" element={<RankingDetail />} />
      <Route path="/myPage" element={<MyPage />} />
      <Route path="/settings" element={<MyPage />} />

      <Route path="/test" element={<TestPage />} />

      <Route element={<AppLayout />}>
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
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;