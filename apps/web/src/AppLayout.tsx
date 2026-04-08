import { Outlet } from "react-router-dom";
import Footer from "./components/Footer";

export default function AppLayout() {
  return (
    <div className="w-[375px] h-[812px] mx-auto relative overflow-hidden bg-white shadow-2xl">
      <div className="w-full h-full overflow-hidden">
        <Outlet />
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-50">
        <Footer />
      </div>
    </div>
  );
}