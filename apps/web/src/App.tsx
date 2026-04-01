import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Upload from "./pages/post/Upload";
import RankingDetail from "./pages/ranking/RankingDetail";
import RankingZone from "./pages/ranking/RankingZone";
import Splash from "./pages/splash/Splash";
import UserFeedDetail from "./pages/feeds/UserFeedDetail";
import MyFeeds from "./pages/feeds/MyFeeds";
import MyFeedEdit from "./pages/feeds/MyFeedEdit";
import UserFeeds from "./pages/feeds/UserFeeds";
import MyFeedDetail from "./pages/feeds/MyFeedDetail";
import AuthEntry from "./pages/auth/AuthEntry";
import FooterTestPage from "./FooterTestPage";
import EvaluationZone from "./pages/evaluation/EvaluationZone";
import EvaluationDetailFeedback from "./pages/evaluation/EvaluationDetail_Feedback";

function AppRoutes() {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/" element={<Splash onFinish={() => navigate("/authEntry")} />} />
      <Route path="/authEntry" element={<AuthEntry />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/rankingZone" element={<RankingZone />} />
      <Route path="/rankingDetail/:postId" element={<RankingDetail />} />

      <Route path="/evaluationZone" element={<EvaluationZone />} />
      <Route path="/evaluationDetailFeedback/:postId" element={<EvaluationDetailFeedback />} />

      <Route path="/postUpload" element={<Upload />} />
      <Route path="/user/:userId/feed" element={<UserFeeds />} />
      <Route path="/user/:userId/feed/:postId" element={<UserFeedDetail />} />

      <Route path="/myFeeds" element={<MyFeeds />} />
      <Route path="/myFeedDetail/:postId" element={<MyFeedDetail />} />
      <Route path="/myFeedEdit" element={<MyFeedEdit />} />
      <Route path="/footer-test" element={<FooterTestPage />} />
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
