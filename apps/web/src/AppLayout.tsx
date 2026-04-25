import { Outlet } from "react-router-dom";
import Footer from "./components/Footer";

export default function AppLayout() {
  return (
    <div
      className="mx-auto relative overflow-hidden shadow-2xl transition-colors duration-200"
      style={{
        width: "var(--app-width)",
        height: "var(--app-height)",
        background: "var(--app-surface)",
        color: "var(--app-text)",
        boxShadow: "0 24px 60px var(--app-shell-shadow)",
      }}
    >
      <div className="w-full h-full overflow-hidden">
        <Outlet />
      </div>

      <div
        className="absolute left-1/2 z-50 -translate-x-1/2"
        style={{
          bottom: "calc(var(--footer-offset) + env(safe-area-inset-bottom))",
          pointerEvents: "none",
        }}
      >
        <Footer />
      </div>
    </div>
  );
}
