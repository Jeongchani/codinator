import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Upload from "./pages/post/Upload";
import RankingDetail from "./pages/ranking/RankingDetail";
import RankingZone from "./pages/ranking/RankingZone";
import Splash from "./pages/splash/Splash";
import UserFeedDetail from "./pages/feeds/UserFeedDetail";
import MyFeedEdit from "./pages/feeds/MyFeedEdit";
import MyFeeds from "./pages/feeds/MyFeeds";
import UserFeeds from "./pages/feeds/UserFeeds";
import MyFeedDetail from "./pages/feeds/MyFeedDetail";
import AuthEntry from "./pages/auth/AuthEntry";
import EvaluationZone from "./pages/evaluation/EvaluationZone";
import EvaluationDetailFeedback from "./pages/evaluation/EvaluationDetail_Feedback";
import AppLayout from "./AppLayout";
import TestPage from "./TestPage";
import Bookmark from "./pages/bookmark/Bookmark";
import MyPage from "./pages/auth/MyPage";

function AppRoutes() {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/" element={<Splash onFinish={() => navigate("/authEntry")} />} />
      <Route path="/authEntry" element={<AuthEntry />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/evaluationZone" element={<EvaluationZone />} />
      <Route path="/evaluationDetailFeedback/:postId" element={<EvaluationDetailFeedback />} />
      <Route path="/postUpload" element={<Upload />} />
      <Route path="/rankingDetail/:postId" element={<RankingDetail />} />
      <Route path="/myFeedEdit" element={<MyFeedEdit />} />
      <Route path="/user/:userId/feed/:postId" element={<UserFeedDetail />} />
      <Route path="/myPage" element={<MyPage />} />
      
      <Route path="/test" element={<TestPage />} />

      <Route element={<AppLayout />}>
        <Route path="/rankingZone" element={<RankingZone />} />
        <Route path="/user/:userId/feed" element={<UserFeeds />} />
        <Route path="/myFeeds" element={<MyFeeds />} />
        <Route path="/myFeedDetail/:postId" element={<MyFeedDetail />} />
        <Route path="/bookmark" element={<Bookmark />} />


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