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
import AppLayout from "./AppLayout";
import FooterTestPage from "./pages/bookmark/FooterTestPage";
import TestPage from "./TestPage";
function AppRoutes() {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/test" element={<TestPage />} />
      <Route path="/" element={<Splash onFinish={() => navigate("/authEntry")} />} />
      <Route path="/authEntry" element={<AuthEntry />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/postUpload" element={<Upload />} />
      <Route path="/rankingDetail/:postId" element={<RankingDetail />} />
      <Route path="/myFeedEdit" element={<MyFeedEdit />} />

      <Route element={<AppLayout />}>
        <Route path="/rankingZone" element={<RankingZone />} />


        <Route path="/user/:userId/feed" element={<UserFeeds />} />
        <Route path="/user/:userId/feed/:postId" element={<UserFeedDetail />} />

        <Route path="/myFeeds" element={<MyFeeds />} />
        <Route path="/myFeedDetail/:postId" element={<MyFeedDetail />} />

        <Route path="/bookMark" element={<FooterTestPage />} />
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