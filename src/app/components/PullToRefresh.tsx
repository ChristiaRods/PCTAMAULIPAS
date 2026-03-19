import { useState, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";

const THRESHOLD = 72;
const MAX_PULL = 120;
const GUINDO = "#AB1738";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

export function PullToRefresh({
  onRefresh,
  children,
  className = "",
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [settling, setSettling] = useState(false);
  const touchRef = useRef<{
    startY: number;
    active: boolean;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (refreshing) return;
      const el = scrollRef.current;
      if (el && el.scrollTop <= 0) {
        touchRef.current = {
          startY: e.touches[0].clientY,
          active: true,
        };
      }
    },
    [refreshing],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchRef.current?.active || refreshing) return;
      const el = scrollRef.current;
      if (el && el.scrollTop > 0) {
        touchRef.current = null;
        setPullDistance(0);
        return;
      }
      const dy = e.touches[0].clientY - touchRef.current.startY;
      if (dy > 0) {
        // Rubber-band effect
        const dist = Math.min(MAX_PULL, dy * 0.45);
        setPullDistance(dist);
      }
    },
    [refreshing],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!touchRef.current?.active) return;
    touchRef.current = null;

    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await onRefresh();
      } catch (err) {
        console.log("Pull-to-refresh error:", err);
      }
      setRefreshing(false);
      setSettling(true);
      setPullDistance(0);
      setTimeout(() => setSettling(false), 300);
    } else {
      setSettling(true);
      setPullDistance(0);
      setTimeout(() => setSettling(false), 300);
    }
  }, [pullDistance, refreshing, onRefresh]);

  const progress = Math.min(1, pullDistance / THRESHOLD);
  const isActive = pullDistance > 0 || refreshing;

  return (
    <div
      ref={scrollRef}
      className={`overflow-y-auto ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {/* Spinner area */}
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: isActive ? pullDistance : 0,
          transition:
            settling || (refreshing && pullDistance === THRESHOLD)
              ? "height 0.3s cubic-bezier(0.25, 1, 0.5, 1)"
              : "none",
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            opacity: refreshing ? 1 : progress,
            transform: refreshing
              ? "scale(1)"
              : `scale(${0.5 + progress * 0.5}) rotate(${progress * 360}deg)`,
            transition: settling
              ? "all 0.3s cubic-bezier(0.25, 1, 0.5, 1)"
              : "none",
          }}
        >
          <Loader2
            className="w-[26px] h-[26px]"
            style={{
              color: GUINDO,
              animation: refreshing
                ? "spin 0.8s linear infinite"
                : "none",
            }}
            strokeWidth={2}
          />
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: isActive
            ? `translateY(0px)`
            : "translateY(0)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
