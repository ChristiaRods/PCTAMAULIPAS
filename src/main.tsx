import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";
import { generatePWAIcons } from "./app/components/IconGenerator";

// Generate PNG icons from SVG for PWA/iOS compatibility
generatePWAIcons();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);