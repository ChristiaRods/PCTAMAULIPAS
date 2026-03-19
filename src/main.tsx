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

  const viewportHeight =
    window.visualViewport?.height ||
    window.innerHeight ||
    document.documentElement.clientHeight;

  document.documentElement.style.setProperty("--app-height", `${Math.round(viewportHeight)}px`);
};

setAppHeight();
if (typeof window !== "undefined") {
  window.addEventListener("resize", setAppHeight, { passive: true });
  window.addEventListener("orientationchange", setAppHeight, { passive: true });
  window.addEventListener("pageshow", setAppHeight, { passive: true });
  document.addEventListener("visibilitychange", setAppHeight, { passive: true });
  window.visualViewport?.addEventListener("resize", setAppHeight, { passive: true });
  requestAnimationFrame(setAppHeight);
  setTimeout(setAppHeight, 150);
  setTimeout(setAppHeight, 600);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
