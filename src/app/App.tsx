import { SimpleRouter } from "./components/RouterContext";
import { LoginScreen } from "./components/LoginScreen";
import { Dashboard911 } from "./components/Dashboard911";
import { ReportDetail } from "./components/ReportDetail";
import { MonitoringDashboard } from "./components/MonitoringDashboard";
import { MonitoringForm } from "./components/MonitoringForm";
import { SupervisorNotifications } from "./components/SupervisorNotifications";
import { AuditDetail } from "./components/AuditDetail";
import { SettingsScreen } from "./components/SettingsScreen";
import { PWAManager } from "./components/PWAManager";
import { useEffect } from "react";
import React from "react";
import {
  peekPendingNotificationId,
  initSWMessageListener,
} from "./components/NotificationDeepLink";

/* ─── Error Boundary to catch runtime crashes ─── */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: "monospace",
            color: "#AB1738",
          }}
        >
          <h2>⚠️ Error de runtime</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const routes = [
  { path: "/", component: LoginScreen },
  { path: "/911", component: Dashboard911 },
  { path: "/911/:id", component: ReportDetail },
  { path: "/monitoreo", component: MonitoringDashboard },
  { path: "/monitoreo/nuevo", component: MonitoringForm },
  { path: "/supervisor", component: SupervisorNotifications },
  { path: "/supervisor/:id", component: AuditDetail },
  { path: "/settings", component: SettingsScreen },
];

/* ─── iOS/Android PWA meta tags (injected once) ─── */
function usePWAMetaTags() {
  useEffect(() => {
    const head = document.head;
    const metas: HTMLElement[] = [];

    const add = (
      tag: string,
      attrs: Record<string, string>,
    ) => {
      const selector = Object.entries(attrs)
        .map(([k, v]) => `[${k}="${v}"]`)
        .join("");
      if (head.querySelector(`${tag}${selector}`)) return;
      const el = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) =>
        el.setAttribute(k, v),
      );
      head.appendChild(el);
      metas.push(el);
    };

    add("meta", { name: "theme-color", content: "#3A0A14" });
    add("meta", {
      name: "apple-mobile-web-app-capable",
      content: "yes",
    });
    add("meta", {
      name: "apple-mobile-web-app-status-bar-style",
      content: "black-translucent",
    });
    add("meta", {
      name: "apple-mobile-web-app-title",
      content: "PC Tamaulipas",
    });
    add("link", { rel: "apple-touch-icon", href: "/icon.svg" });

    const viewport = head.querySelector(
      'meta[name="viewport"]',
    );
    if (viewport) {
      let content = viewport.getAttribute("content") || "";
      if (!content.includes("viewport-fit=cover")) {
        content += ", viewport-fit=cover";
      }
      if (!content.includes("maximum-scale")) {
        content += ", maximum-scale=1, user-scalable=no";
      }
      viewport.setAttribute("content", content);
    }

    return () => metas.forEach((el) => el.remove());
  }, []);
}

export default function App() {
  usePWAMetaTags();

  useEffect(() => {
    initSWMessageListener();
  }, []);

  const hasDeepLink = peekPendingNotificationId() !== null;

  return (
    <ErrorBoundary>
      <SimpleRouter
        routes={routes}
        initialPath={hasDeepLink ? "/supervisor" : undefined}
      />
      <PWAManager />
    </ErrorBoundary>
  );
}