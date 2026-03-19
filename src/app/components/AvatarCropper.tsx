import { useState, useRef, useCallback, useEffect } from "react";
import { X, Check, ZoomIn, ZoomOut } from "lucide-react";
import { motion } from "motion/react";

const CIRCLE_SIZE = 280;

interface Props {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

export function AvatarCropper({ imageSrc, onConfirm, onCancel }: Props) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const [imgDisplaySize, setImgDisplaySize] = useState({ w: 0, h: 0 });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const gestureRef = useRef<{
    initialDistance: number;
    initialScale: number;
    initialTranslate: { x: number; y: number };
    isPinching: boolean;
    isPanning: boolean;
    panStart: { x: number; y: number };
    initialCenter: { x: number; y: number };
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load image to get natural dimensions and compute initial fit
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });

      const cw = containerSize.w || window.innerWidth;
      const ch = containerSize.h || window.innerHeight * 0.65;

      // Display size: fit in container
      const displayScale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
      const dw = img.naturalWidth * displayScale;
      const dh = img.naturalHeight * displayScale;
      setImgDisplaySize({ w: dw, h: dh });

      // Initial scale so image covers the circle
      const coverScale = CIRCLE_SIZE / Math.min(dw, dh);
      setScale(Math.max(1, coverScale));
      setTranslate({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [imageSrc, containerSize.w, containerSize.h]);

  const getDistance = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const getCenter = (t1: React.Touch, t2: React.Touch) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  });

  const minScale = useCallback(() => {
    if (!imgDisplaySize.w || !imgDisplaySize.h) return 1;
    return Math.max(1, CIRCLE_SIZE / Math.min(imgDisplaySize.w, imgDisplaySize.h));
  }, [imgDisplaySize]);

  const clampTranslate = useCallback(
    (tx: number, ty: number, s: number) => {
      const scaledW = imgDisplaySize.w * s;
      const scaledH = imgDisplaySize.h * s;
      const maxX = Math.max(0, (scaledW - CIRCLE_SIZE) / 2);
      const maxY = Math.max(0, (scaledH - CIRCLE_SIZE) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, tx)),
        y: Math.min(maxY, Math.max(-maxY, ty)),
      };
    },
    [imgDisplaySize]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        gestureRef.current = {
          initialDistance: getDistance(e.touches[0], e.touches[1]),
          initialScale: scale,
          initialTranslate: { ...translate },
          isPinching: true,
          isPanning: false,
          panStart: { x: 0, y: 0 },
          initialCenter: getCenter(e.touches[0], e.touches[1]),
        };
      } else if (e.touches.length === 1) {
        gestureRef.current = {
          initialDistance: 0,
          initialScale: scale,
          initialTranslate: { ...translate },
          isPinching: false,
          isPanning: true,
          panStart: { x: e.touches[0].clientX, y: e.touches[0].clientY },
          initialCenter: { x: 0, y: 0 },
        };
      }
    },
    [scale, translate]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!gestureRef.current) return;

      if (gestureRef.current.isPinching && e.touches.length === 2) {
        e.preventDefault();
        const dist = getDistance(e.touches[0], e.touches[1]);
        const newScale = Math.min(
          6,
          Math.max(minScale(), gestureRef.current.initialScale * (dist / gestureRef.current.initialDistance))
        );
        setScale(newScale);

        const center = getCenter(e.touches[0], e.touches[1]);
        const dx = center.x - gestureRef.current.initialCenter.x;
        const dy = center.y - gestureRef.current.initialCenter.y;
        setTranslate(
          clampTranslate(gestureRef.current.initialTranslate.x + dx, gestureRef.current.initialTranslate.y + dy, newScale)
        );
      } else if (gestureRef.current.isPanning && e.touches.length === 1) {
        const dx = e.touches[0].clientX - gestureRef.current.panStart.x;
        const dy = e.touches[0].clientY - gestureRef.current.panStart.y;
        setTranslate(
          clampTranslate(gestureRef.current.initialTranslate.x + dx, gestureRef.current.initialTranslate.y + dy, scale)
        );
      }
    },
    [scale, minScale, clampTranslate]
  );

  const handleTouchEnd = useCallback(() => {
    gestureRef.current = null;
    setTranslate((t) => clampTranslate(t.x, t.y, scale));
  }, [scale, clampTranslate]);

  // Zoom buttons
  const zoomIn = () => {
    const newS = Math.min(6, scale * 1.3);
    setScale(newS);
    setTranslate((t) => clampTranslate(t.x, t.y, newS));
  };
  const zoomOut = () => {
    const newS = Math.max(minScale(), scale / 1.3);
    setScale(newS);
    setTranslate((t) => clampTranslate(t.x, t.y, newS));
  };

  // Mouse drag for desktop
  const mouseRef = useRef<{ dragging: boolean; startX: number; startY: number; initTx: number; initTy: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      mouseRef.current = {
        dragging: true,
        startX: e.clientX,
        startY: e.clientY,
        initTx: translate.x,
        initTy: translate.y,
      };
    },
    [translate]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!mouseRef.current?.dragging) return;
      const dx = e.clientX - mouseRef.current.startX;
      const dy = e.clientY - mouseRef.current.startY;
      setTranslate(clampTranslate(mouseRef.current.initTx + dx, mouseRef.current.initTy + dy, scale));
    };
    const onUp = () => {
      if (mouseRef.current) mouseRef.current.dragging = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [scale, clampTranslate]);

  // Mouse wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      const newS = Math.min(6, Math.max(minScale(), scale * delta));
      setScale(newS);
      setTranslate((t) => clampTranslate(t.x, t.y, newS));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [scale, minScale, clampTranslate]);

  // Crop and confirm
  const handleConfirm = useCallback(() => {
    if (!imgNatural.w || !imgDisplaySize.w) return;

    const canvas = document.createElement("canvas");
    const outputSize = 512;
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d")!;

    // Clip to circle
    ctx.beginPath();
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const displayToNatural = imgNatural.w / imgDisplaySize.w;
    const circleCenterInImgX = imgNatural.w / 2 - (translate.x / scale) * displayToNatural;
    const circleCenterInImgY = imgNatural.h / 2 - (translate.y / scale) * (imgNatural.h / imgDisplaySize.h);
    const circleRadiusInImg = (CIRCLE_SIZE / 2 / scale) * displayToNatural;

    const srcX = circleCenterInImgX - circleRadiusInImg;
    const srcY = circleCenterInImgY - circleRadiusInImg;
    const srcSize = circleRadiusInImg * 2;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, outputSize, outputSize);
      canvas.toBlob(
        (blob) => {
          if (blob) onConfirm(blob);
        },
        "image/jpeg",
        0.9
      );
    };
    img.src = imageSrc;
  }, [imgNatural, imgDisplaySize, translate, scale, imageSrc, onConfirm]);

  const isGesturing = gestureRef.current !== null || mouseRef.current?.dragging;

  // Use a single CSS approach for the circle mask overlay
  const circleOverlayStyle = `
    .crop-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 10;
    }
    .crop-overlay::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(
        circle ${CIRCLE_SIZE / 2}px at 50% 50%,
        transparent ${CIRCLE_SIZE / 2 - 1}px,
        rgba(0, 0, 0, 0.65) ${CIRCLE_SIZE / 2}px
      );
    }
    .crop-overlay::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: ${CIRCLE_SIZE}px;
      height: ${CIRCLE_SIZE}px;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      border: 1.5px solid rgba(255, 255, 255, 0.45);
    }
  `;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[250] flex flex-col"
      style={{ background: "#000" }}
    >
      <style>{circleOverlayStyle}</style>

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 shrink-0 relative z-20"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          minHeight: 52,
        }}
      >
        <button
          onClick={onCancel}
          className="w-[44px] h-[44px] flex items-center justify-center active:opacity-50 transition-opacity"
        >
          <X className="w-[22px] h-[22px] text-white" strokeWidth={1.8} />
        </button>
        <span className="text-[17px] text-white" style={{ fontWeight: 600 }}>
          Mover y Escalar
        </span>
        <div className="w-[44px]" />
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        style={{ touchAction: "none", cursor: "grab" }}
      >
        {/* The image */}
        {imgDisplaySize.w > 0 && (
          <img
            src={imageSrc}
            alt="Recortar"
            className="select-none pointer-events-none"
            draggable={false}
            style={{
              width: imgDisplaySize.w,
              height: imgDisplaySize.h,
              transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
              transition: isGesturing ? "none" : "transform 0.2s ease-out",
            }}
          />
        )}

        {/* Single unified circle overlay — dark outside, clear inside, one border */}
        <div className="crop-overlay" />
      </div>

      {/* Zoom controls + hint */}
      <div className="shrink-0 flex flex-col items-center gap-3 px-6 pt-3">
        <p className="text-[13px] text-white/50" style={{ fontWeight: 400 }}>
          Arrastra para mover · Pellizca para zoom
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={zoomOut}
            className="w-[44px] h-[44px] rounded-full flex items-center justify-center active:opacity-50 transition-opacity"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            <ZoomOut className="w-[20px] h-[20px] text-white" strokeWidth={1.6} />
          </button>

          <div className="flex-1 max-w-[160px] h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
            <div
              className="h-full rounded-full transition-all duration-150"
              style={{
                width: `${Math.min(100, ((scale - 1) / 5) * 100)}%`,
                background: "rgba(255,255,255,0.6)",
              }}
            />
          </div>

          <button
            onClick={zoomIn}
            className="w-[44px] h-[44px] rounded-full flex items-center justify-center active:opacity-50 transition-opacity"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            <ZoomIn className="w-[20px] h-[20px] text-white" strokeWidth={1.6} />
          </button>
        </div>
      </div>

      {/* Bottom actions */}
      <div
        className="shrink-0 flex items-center justify-center gap-6 px-6"
        style={{
          paddingTop: 16,
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
        }}
      >
        <button
          onClick={onCancel}
          className="flex-1 py-[14px] rounded-full active:opacity-70 transition-opacity"
          style={{
            background: "rgba(255,255,255,0.12)",
            minHeight: 50,
          }}
        >
          <span className="text-[17px] text-white" style={{ fontWeight: 500 }}>
            Cancelar
          </span>
        </button>
        <button
          onClick={handleConfirm}
          className="flex-1 py-[14px] rounded-full flex items-center justify-center gap-2 active:opacity-70 transition-opacity"
          style={{
            background: "linear-gradient(135deg, #AB1738, #8B1028)",
            minHeight: 50,
          }}
        >
          <Check className="w-[18px] h-[18px] text-white" strokeWidth={2.2} />
          <span className="text-[17px] text-white" style={{ fontWeight: 600 }}>
            Usar Foto
          </span>
        </button>
      </div>
    </motion.div>
  );
}