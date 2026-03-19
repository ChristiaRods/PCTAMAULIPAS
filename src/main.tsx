import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";
import { generatePWAIcons } from "./app/components/IconGenerator";

// Generate PNG icons from SVG for PWA/iOS compatibility
generatePWAIcons();

// Keep app shell height aligned with the real visible viewport on mobile PWAs.
const setAppHeight = () => {
  if (typeof window === "undefined") return;

  const inner = window.innerHeight ?? 0;
  const doc = document.documentElement.clientHeight ?? 0;
  const vv = window.visualViewport;
  const vvComposed = vv ? vv.height + vv.offsetTop : 0;

  const candidates = [inner, doc, vvComposed].filter(
    (value) => Number.isFinite(value) && value > 0,
  );
  if (candidates.length === 0) return;

  // On iOS Safari/PWA, visualViewport can get stuck smaller after keyboard.
  // Use the largest stable layout height so the shell never remains truncated.
  const viewportHeight = Math.max(...candidates);
  document.documentElement.style.setProperty(
    "--app-height",
    `${Math.round(viewportHeight)}px`,
  );
};

setAppHeight();
if (typeof window !== "undefined") {
  window.addEventListener("resize", setAppHeight, { passive: true });
  window.addEventListener("orientationchange", setAppHeight, { passive: true });
  window.addEventListener("pageshow", setAppHeight, { passive: true });
  document.addEventListener("visibilitychange", setAppHeight, { passive: true });
  window.visualViewport?.addEventListener("resize", setAppHeight, { passive: true });
  window.visualViewport?.addEventListener("scroll", setAppHeight, { passive: true });
  requestAnimationFrame(setAppHeight);
  setTimeout(setAppHeight, 150);
  setTimeout(setAppHeight, 600);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
