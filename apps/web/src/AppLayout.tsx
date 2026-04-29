import { Outlet } from "react-router-dom";
import Footer from "./components/Footer";

export default function AppLayout() {
  return (
    <div
      className="mx-auto relative overflow-hidden shadow-2xl transition-colors duration-200"
      style={{
        width: "var(--app-width)",
        height: "var(--app-height)",
        background: "var(--app-surface, var(--color-page-bg, #ffffff))",
        color: "var(--app-text, #111827)",
        boxShadow: "0 24px 60px var(--app-shell-shadow, rgba(15, 23, 42, 0.16))",
      }}
    >
      <div className="w-full h-full overflow-hidden">
        <Outlet />
      </div>

      <div
        className="absolute left-0 bottom-0 z-50 w-full"
        style={{
          pointerEvents: "none",
        }}
      >
        <Footer />
      </div>
    </div>
  );
}
