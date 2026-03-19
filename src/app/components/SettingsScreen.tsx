import { useGoBack } from "./RouterContext";
import { SettingsView } from "./SettingsView";

/* ═══════════════════════════════════════════════════════════════
   SETTINGS SCREEN — Pushed overlay screen from /supervisor
   Hides LiquidGlassNav, shows back arrow, no bottom conflicts
   ═══════════════════════════════════════════════════════════════ */
export function SettingsScreen() {
  const goBack = useGoBack();

  return (
    <div
      className="flex flex-col"
      style={{
        minHeight: "100dvh",
        background: "#F2F2F7",
      }}
    >
      <SettingsView onClose={goBack} />
    </div>
  );
}
