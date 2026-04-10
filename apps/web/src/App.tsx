import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Upload from "./pages/post/Upload";
import RankingZone from "./pages/ranking/RankingZone";
import Splash from "./pages/splash/Splash";
import MyFeeds from "./pages/feeds/MyFeeds";
import MyFeedDetail from "./pages/feeds/MyFeedDetail";
import AuthEntry from "./pages/auth/AuthEntry";
import AppLayout from "./AppLayout";
import TestPage from "./TestPage";
import Bookmark from "./pages/bookmark/Bookmark";
import MyPage from "./pages/auth/MyPage";
import Search from "./pages/search/Search";
import EvaluationZone from "./pages/evaluation/EvaluationZone";
import EvaluationDetailFeedback from "./pages/evaluation/EvaluationDetail_Feedback";
import RankingDetail from "./pages/ranking/RankingDetail";
import UserFeed from "./pages/feeds/UserFeed";

function AppRoutes() {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/" element={<Splash onFinish={() => navigate("/authEntry")} />} />
      <Route path="/authEntry" element={<AuthEntry />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/evaluationZone" element={<EvaluationZone/>} />
      <Route path="/evaluationDetailFeedback/:postId" element={<EvaluationDetailFeedback />} />
      <Route path="/postUpload" element={<Upload />} />
      <Route path="/rankingDetail/:postId" element={<RankingDetail />} />
      <Route path="/myPage" element={<MyPage />} />
      <Route path="/settings" element={<MyPage />} />

      <Route path="/test" element={<TestPage />} />

      <Route element={<AppLayout />}>
        <Route path="/rankingZone" element={<RankingZone />} />
        <Route path="/user/:userId/feed" element={<UserFeed />} />
        <Route path="/myFeeds" element={<MyFeeds />} />
        <Route path="/myFeedDetail/:postId" element={<MyFeedDetail />} />
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