import React, { useState } from "react";
import { Wifi, WifiOff, ChevronLeft, Shield, Settings } from "lucide-react";
import { useLocation, useGoBack } from "./RouterContext";
import { PCShieldIcon } from "./PCShieldIcon";

export function AppHeader({
  title,
  showBack = true,
  onBack,
  onSettingsPress,
  children,
}: {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  onSettingsPress?: () => void;
  children?: React.ReactNode;
}) {
  const goBack = useGoBack();
  const location = useLocation();
  const [isOnline] = useState(true);

  const isRoot = location.pathname === "/";

  return (
    <header
      className="sticky top-0 z-50 relative overflow-hidden"
      style={{
        background: "linear-gradient(to bottom, rgba(58,10,20,0.86), rgba(92,16,32,0.82), rgba(78,11,21,0.85))",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.09), 0 4px 20px rgba(30,5,9,0.35), 0 1px 3px rgba(30,5,9,0.2)",
      }}
    >
      {/* Specular top edge — light reflection on the glass rim */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: "1px",
          background: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.12) 40%, rgba(255,255,255,0.14) 60%, rgba(255,255,255,0.04) 100%)",
        }}
      />

      {/* Inner glow — subtle warm luminosity inside the glass */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 120% 60% at 50% -10%, rgba(188,149,91,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Shield watermark */}
      <div className="absolute inset-0 flex items-center justify-end pointer-events-none overflow-hidden">
        <Shield
          className="w-28 h-28 text-white/[0.03] -mr-4"
          strokeWidth={0.8}
        />
      </div>

      {/* Bottom separator — soft glass edge */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: "0.5px",
          background: "linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.08) 70%, transparent 95%)",
        }}
      />

      {/* Safe-area spacer for iOS status bar */}
      <div style={{ height: "env(safe-area-inset-top, 0px)" }} />

      {/* Header content */}
      <div className="relative z-10 px-4 py-3.5 flex items-center gap-3">
        {showBack && !isRoot && (
          <button
            onClick={() => (onBack ? onBack() : goBack())}
            className="w-9 h-9 -ml-1 rounded-xl flex items-center justify-center active:bg-white/15 transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-white/90" strokeWidth={2.5} />
          </button>
        )}
        {isRoot && <PCShieldIcon size={22} glow />}
        <h1 className="flex-1 text-[17px] text-white/95 truncate tracking-tight">{title}</h1>

        {/* Settings gear icon (for main screens without nav bar) */}
        {onSettingsPress && (
          <button
            onClick={onSettingsPress}
            className="w-9 h-9 rounded-xl flex items-center justify-center active:bg-white/15 transition-colors"
          >
            <Settings className="w-5 h-5 text-white/70" strokeWidth={1.8} />
          </button>
        )}

        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
          style={{
            background: "rgba(255,255,255,0.07)",
            boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.10), 0 0.5px 1px rgba(0,0,0,0.15)",
            border: "0.5px solid rgba(255,255,255,0.08)",
          }}
        >
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4 text-green-400" strokeWidth={2} />
              <span className="text-[13px] text-green-400">En linea</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-yellow-400" strokeWidth={2} />
              <span className="text-[13px] text-yellow-400">Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Additional sticky content (search bars, etc.) */}
      {children && (
        <div className="relative z-10 px-4 pb-3">
          {children}
        </div>
      )}
    </header>
  );
}