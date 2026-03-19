import { useCallback, useRef } from "react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  containerRef?: React.Ref<HTMLDivElement>;
}

export function PullToRefresh({
  onRefresh: _onRefresh,
  children,
  className = "",
  containerRef,
}: PullToRefreshProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef.current = node;
      if (!containerRef) return;
      if (typeof containerRef === "function") {
        containerRef(node);
        return;
      }
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [containerRef],
  );

  return (
    <div
      ref={setContainerRef}
      className={`overflow-y-auto ${className}`}
      style={{
        WebkitOverflowScrolling: "touch",
        overscrollBehaviorY: "auto",
        touchAction: "auto",
      }}
    >
      {children}
    </div>
  );
}
