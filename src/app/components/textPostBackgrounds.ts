/* ═══════════════════════════════════════════════════════════════
   textPostBackgrounds.ts — 13 fondos para posts de solo texto
   7 guindo-dominant → reporte911
   6 neutro/cálido-dominant → monitoreo
   Paleta institucional: #AB1738, #BC955B, #E6D5B5, #54565B,
                         #4E0B15, #CDA67A, #631832
   ═══════════════════════════════════════════════════════════════ */

import type { CSSProperties } from "react";

export interface TextPostBackground {
  gradient: string;
  pattern: CSSProperties;
}

/* ─── REPORTE 911 — Guindo dominant (7) ─── */
export const REPORTE_BACKGROUNDS: TextPostBackground[] = [
  // 0 — Guindo → Guindo Oscuro + Radial circles
  {
    gradient: "linear-gradient(135deg, #AB1738 0%, #7A1028 50%, #4E0B15 100%)",
    pattern: {
      backgroundImage: `
        radial-gradient(circle at 20% 30%, rgba(188,149,91,0.12) 0%, rgba(188,149,91,0.12) 60px, transparent 60px),
        radial-gradient(circle at 80% 20%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.06) 80px, transparent 80px),
        radial-gradient(circle at 60% 80%, rgba(188,149,91,0.08) 0%, rgba(188,149,91,0.08) 50px, transparent 50px),
        radial-gradient(circle at 10% 90%, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.05) 40px, transparent 40px),
        radial-gradient(circle at 90% 70%, rgba(188,149,91,0.10) 0%, rgba(188,149,91,0.10) 35px, transparent 35px)
      `,
    },
  },
  // 1 — Dorado → Guindo Oscuro + Diagonal stripes
  {
    gradient: "linear-gradient(135deg, #BC955B 0%, #8B5A3C 40%, #4E0B15 100%)",
    pattern: {
      backgroundImage: `repeating-linear-gradient(
        -45deg,
        transparent,
        transparent 14px,
        rgba(255,255,255,0.07) 14px,
        rgba(255,255,255,0.07) 16px
      )`,
    },
  },
  // 2 — Guindo → Dorado + Concentric rings
  {
    gradient: "linear-gradient(160deg, #AB1738 0%, #631832 50%, #BC955B 100%)",
    pattern: {
      backgroundImage: `
        radial-gradient(circle at 50% 50%, transparent 30px, rgba(255,255,255,0.04) 31px, rgba(255,255,255,0.04) 32px, transparent 33px),
        radial-gradient(circle at 50% 50%, transparent 60px, rgba(188,149,91,0.06) 61px, rgba(188,149,91,0.06) 62px, transparent 63px),
        radial-gradient(circle at 50% 50%, transparent 90px, rgba(255,255,255,0.05) 91px, rgba(255,255,255,0.05) 92px, transparent 93px),
        radial-gradient(circle at 50% 50%, transparent 120px, rgba(188,149,91,0.04) 121px, rgba(188,149,91,0.04) 122px, transparent 123px)
      `,
    },
  },
  // 3 — Guindo Medio → Guindo + Triangles (chevron)
  {
    gradient: "linear-gradient(135deg, #631832 0%, #AB1738 50%, #4E0B15 100%)",
    pattern: {
      backgroundImage: `
        linear-gradient(60deg, transparent 45%, rgba(188,149,91,0.08) 45%, rgba(188,149,91,0.08) 55%, transparent 55%),
        linear-gradient(-60deg, transparent 45%, rgba(188,149,91,0.08) 45%, rgba(188,149,91,0.08) 55%, transparent 55%)
      `,
      backgroundSize: "60px 40px",
    },
  },
  // 4 — Gradiente institucional trio + Horizontal bars
  {
    gradient: "linear-gradient(135deg, #AB1738 0%, #631832 35%, #BC955B 70%, #4E0B15 100%)",
    pattern: {
      backgroundImage: `repeating-linear-gradient(
        0deg,
        transparent,
        transparent 20px,
        rgba(255,255,255,0.05) 20px,
        rgba(255,255,255,0.05) 22px
      )`,
    },
  },
  // 5 — Guindo → Gris + Dot grid
  {
    gradient: "linear-gradient(145deg, #AB1738 0%, #54565B 100%)",
    pattern: {
      backgroundImage: `radial-gradient(circle, rgba(188,149,91,0.15) 1.5px, transparent 1.5px)`,
      backgroundSize: "20px 20px",
    },
  },
  // 6 — Guindo Oscuro → Dorado + Starburst
  {
    gradient: "linear-gradient(135deg, #4E0B15 0%, #631832 40%, #CDA67A 100%)",
    pattern: {
      backgroundImage: `
        conic-gradient(from 0deg at 25% 35%, transparent 0deg, rgba(255,255,255,0.04) 10deg, transparent 20deg),
        conic-gradient(from 90deg at 75% 65%, transparent 0deg, rgba(188,149,91,0.06) 15deg, transparent 30deg),
        conic-gradient(from 180deg at 50% 80%, transparent 0deg, rgba(255,255,255,0.03) 12deg, transparent 24deg)
      `,
    },
  },
];

/* ─── MONITOREO — Neutro/Cálido dominant (6) ─── */
export const MONITOREO_BACKGROUNDS: TextPostBackground[] = [
  // 0 — Gris → Guindo + Checkerboard
  {
    gradient: "linear-gradient(135deg, #54565B 0%, #2A2B2E 50%, #3A3C40 100%)",
    pattern: {
      backgroundImage: `
        linear-gradient(45deg, rgba(188,149,91,0.08) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(188,149,91,0.08) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(188,149,91,0.08) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(188,149,91,0.08) 75%)
      `,
      backgroundSize: "40px 40px",
      backgroundPosition: "0 0, 0 20px, 20px -20px, -20px 0px",
    },
  },
  // 1 — Guindo Oscuro → Gris + Hex dots
  {
    gradient: "linear-gradient(135deg, #4E0B15 0%, #3A3C40 50%, #54565B 100%)",
    pattern: {
      backgroundImage: `
        radial-gradient(circle, rgba(188,149,91,0.12) 3px, transparent 3px),
        radial-gradient(circle, rgba(188,149,91,0.08) 3px, transparent 3px)
      `,
      backgroundSize: "36px 62px",
      backgroundPosition: "0 0, 18px 31px",
    },
  },
  // 2 — Dorado Oscuro → Dorado + Diamonds
  {
    gradient: "linear-gradient(135deg, #CDA67A 0%, #BC955B 50%, #8B6D3F 100%)",
    pattern: {
      backgroundImage: `
        linear-gradient(45deg, rgba(78,11,21,0.10) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(78,11,21,0.10) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(78,11,21,0.10) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(78,11,21,0.10) 75%)
      `,
      backgroundSize: "32px 32px",
      backgroundPosition: "0 0, 0 16px, 16px -16px, -16px 0px",
    },
  },
  // 3 — Beige → Dorado + Zigzag / chevron
  {
    gradient: "linear-gradient(135deg, #E6D5B5 0%, #CDA67A 50%, #BC955B 100%)",
    pattern: {
      backgroundImage: `
        linear-gradient(135deg, rgba(78,11,21,0.08) 25%, transparent 25%),
        linear-gradient(225deg, rgba(78,11,21,0.08) 25%, transparent 25%)
      `,
      backgroundSize: "30px 30px",
      backgroundPosition: "0 0, 15px 0",
    },
  },
  // 4 — Gris → Dorado Oscuro + Cross-hatch
  {
    gradient: "linear-gradient(160deg, #54565B 0%, #3A3C40 50%, #CDA67A 100%)",
    pattern: {
      backgroundImage: `
        repeating-linear-gradient(
          45deg,
          transparent,
          transparent 10px,
          rgba(188,149,91,0.08) 10px,
          rgba(188,149,91,0.08) 11px
        ),
        repeating-linear-gradient(
          -45deg,
          transparent,
          transparent 10px,
          rgba(188,149,91,0.08) 10px,
          rgba(188,149,91,0.08) 11px
        )
      `,
    },
  },
  // 5 — Dorado → Beige + Waves
  {
    gradient: "linear-gradient(135deg, #BC955B 0%, #E6D5B5 50%, #CDA67A 100%)",
    pattern: {
      backgroundImage: `
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 18px,
          rgba(78,11,21,0.06) 18px,
          rgba(78,11,21,0.06) 20px
        ),
        repeating-linear-gradient(
          90deg,
          transparent,
          transparent 40px,
          rgba(78,11,21,0.04) 40px,
          rgba(78,11,21,0.04) 42px
        )
      `,
    },
  },
];

/* ─── Deterministic ID → Background mapping ─── */

/* Ordered list of text-only post IDs per type (ensures 1:1 assignment) */
const REPORTE_IDS = [
  "911-2026-0138",  // Inundación Vial
  "911-2026-0140",  // Supuesto Derrame Químico
  "911-2026-0149",  // Rescate en Canal de Riego
  "911-2026-0150",  // Caída de Espectacular
  "911-2026-0151",  // Intoxicación por Humo
  "911-2026-0152",  // Cable de Alta Tensión Caído
  "911-2026-0153",  // Deslizamiento de Tierra
];

const MONITOREO_IDS = [
  "MON-2026-0016",  // Monitoreo Diario
  "MON-2026-0014",  // 1er Periodo Vacacional
  "MON-2026-0017",  // Simulacro Regional
  "MON-2026-0018",  // Alerta por Oleaje
  "MON-2026-0019",  // Revisión de Infraestructura
  "MON-2026-0020",  // Fumigación Preventiva
];

/**
 * Returns the gradient + pattern background for a text-only post.
 * Uses deterministic 1:1 mapping from ID → background index.
 * Falls back to hash for unknown IDs.
 */
export function getTextPostBackground(
  id: string,
  type: "reporte911" | "monitoreo"
): TextPostBackground {
  const ids = type === "reporte911" ? REPORTE_IDS : MONITOREO_IDS;
  const pool = type === "reporte911" ? REPORTE_BACKGROUNDS : MONITOREO_BACKGROUNDS;

  const idx = ids.indexOf(id);
  if (idx >= 0) return pool[idx % pool.length];

  // Fallback: hash-based selection for any new/unknown IDs
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return pool[Math.abs(hash) % pool.length];
}
