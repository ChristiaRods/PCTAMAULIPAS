/**
 * PCShieldIcon — Escudo de Protección Civil Tamaulipas
 * Componente SVG inline siguiendo iOS 26 Liquid Glass guidelines.
 * Uso: <PCShieldIcon size={40} /> o <PCShieldIcon className="w-6 h-6" />
 */
import React, { useId } from "react";

export function PCShieldIcon({
  size,
  className,
  style,
  glow = false,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Adds a subtle outer glow — useful on dark backgrounds */
  glow?: boolean;
}) {
  // Unique prefix to avoid gradient ID collisions when rendered multiple times
  const uid = useId().replace(/:/g, "");

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      width={size || undefined}
      height={size || undefined}
      className={className}
      style={{
        ...style,
        ...(glow
          ? {
              filter:
                "drop-shadow(0 2px 12px rgba(171,23,56,0.35))",
            }
          : {}),
      }}
    >
      <defs>
        <linearGradient
          id={`${uid}-bg`}
          x1=".5"
          y1="0"
          x2=".5"
          y2="1"
        >
          <stop offset="0%" stopColor="#D42D50" />
          <stop offset="40%" stopColor="#AB1738" />
          <stop offset="100%" stopColor="#6A0B20" />
        </linearGradient>
        <linearGradient
          id={`${uid}-sf`}
          x1=".5"
          y1="0"
          x2=".5"
          y2="1"
        >
          <stop offset="0%" stopColor="#C72446" />
          <stop offset="55%" stopColor="#A81536" />
          <stop offset="100%" stopColor="#7E0F29" />
        </linearGradient>
        <linearGradient
          id={`${uid}-au`}
          x1=".2"
          y1="0"
          x2=".9"
          y2="1"
        >
          <stop offset="0%" stopColor="#EDD49C" />
          <stop offset="40%" stopColor="#D4A95A" />
          <stop offset="100%" stopColor="#B08542" />
        </linearGradient>
        <linearGradient
          id={`${uid}-gl`}
          x1=".5"
          y1="0"
          x2=".5"
          y2=".6"
        >
          <stop
            offset="0%"
            stopColor="rgba(255,255,255,0.16)"
          />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <radialGradient
          id={`${uid}-vi`}
          cx=".5"
          cy=".38"
          r=".68"
        >
          <stop
            offset="0%"
            stopColor="rgba(255,255,255,0.02)"
          />
          <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
        </radialGradient>
      </defs>

      {/* Background */}
      <rect
        width="1024"
        height="1024"
        fill={`url(#${uid}-bg)`}
        rx="200"
      />
      <rect
        width="1024"
        height="1024"
        fill={`url(#${uid}-vi)`}
        rx="200"
      />

      {/* Shield */}
      <path
        d="M512 150 L735 244 C740 246,744 252,744 258 L744 490 C744 590,696 670,632 722 C580 766,530 798,512 808 C494 798,444 766,392 722 C328 670,280 590,280 490 L280 258 C280 252,284 246,289 244Z"
        fill={`url(#${uid}-sf)`}
        stroke={`url(#${uid}-au)`}
        strokeWidth="8"
        strokeLinejoin="round"
      />

      {/* Shield glow */}
      <path
        d="M512 172 L724 260 724 488 C724 582,680 656,620 706 C570 750,526 778,512 788 C498 778,454 750,404 706 C344 656,300 582,300 488 L300 260Z"
        fill={`url(#${uid}-gl)`}
      />

      {/* Gold divider */}
      <rect
        x="374"
        y="540"
        width="276"
        height="5"
        rx="2.5"
        fill={`url(#${uid}-au)`}
        opacity="0.5"
      />

      {/* PC monogram */}
      <text
        x="512"
        y="502"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="system-ui, -apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
        fontWeight="900"
        fontSize="260"
        fill="#FFFFFF"
        letterSpacing="6"
        opacity="0.97"
      >
        PC
      </text>

      {/* Star */}
      <path
        d="M512 590 L526 632 572 632 536 660 548 702 512 674 476 702 488 660 452 632 498 632Z"
        fill={`url(#${uid}-au)`}
        opacity="0.75"
      />
    </svg>
  );
}