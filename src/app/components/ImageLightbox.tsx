import React, { useState, useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

/* ─── Format timestamp to human-readable ─── */
const MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
function formatHumanTimestamp(raw: string): string {
  const dateMatch = raw.match(/(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{1,2}):(\d{2})/);
  if (!dateMatch) return raw;
  const [, dd, mm, yyyy, hh, min] = dateMatch;
  const day = parseInt(dd, 10);
  const month = MONTHS[parseInt(mm, 10) - 1];
  let hour = parseInt(hh, 10);
  const ampm = hour >= 12 ? "p.m." : "a.m.";
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${day} de ${month} de ${yyyy} · ${hour}:${min} ${ampm}`;
}

export interface LightboxData {
  images: string[];
  title: string;
  timestamp: string;
  description: string;
  startIndex?: number;
}

interface ImageLightboxProps {
  data: LightboxData;
  onClose: () => void;
}

/* ─── Constants ─── */
const SWIPE_X_THRESHOLD = 40;
const SWIPE_Y_CLOSE_THRESHOLD = 120;
const DISMISS_OPACITY_RANGE = 250;
const AXIS_LOCK_PX = 5;
const SLIDE_DURATION = 220;

// Zoom
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const DOUBLE_TAP_DELAY = 300;
const DOUBLE_TAP_DIST = 30;

/* ─── Helpers ─── */
function getDistance(t1: React.Touch | Touch, t2: React.Touch | Touch) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getMidpoint(t1: React.Touch | Touch, t2: React.Touch | Touch) {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}

export function ImageLightbox({ data, onClose }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(data.startIndex ?? 0);
  const [expanded, setExpanded] = useState(false);

  /* ─── Slide transition state ─── */
  const [slideDirection, setSlideDirection] = useState<"none" | "left" | "right">("none");
  const [isAnimating, setIsAnimating] = useState(false);

  /* ─── Refs: DOM ─── */
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const zoomWrapperRef = useRef<HTMLDivElement>(null);

  /* ─── Refs: Swipe gesture (1-finger, zoom=1) ─── */
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const dragX = useRef(0);
  const dragY = useRef(0);
  const isDragging = useRef(false);
  const axis = useRef<"none" | "x" | "y">("none");

  /* ─── Refs: Zoom state ─── */
  const zoomScale = useRef(1);
  const zoomTx = useRef(0);
  const zoomTy = useRef(0);

  /* ─── Refs: Pinch gesture ─── */
  const isPinching = useRef(false);
  const pinchStartDist = useRef(0);
  const pinchStartScale = useRef(1);
  const pinchStartTx = useRef(0);
  const pinchStartTy = useRef(0);
  const pinchMidX = useRef(0);
  const pinchMidY = useRef(0);

  /* ─── Refs: Pan while zoomed ─── */
  const isPanning = useRef(false);
  const panStartX = useRef(0);
  const panStartY = useRef(0);
  const panStartTx = useRef(0);
  const panStartTy = useRef(0);

  /* ─── Refs: Double-tap ─── */
  const lastTapTime = useRef(0);
  const lastTapX = useRef(0);
  const lastTapY = useRef(0);
  const tapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = data.images.length;
  const hasMultiple = total > 1;

  /* ════════════════════════════════════════════════
     ZOOM TRANSFORM HELPERS
     ════════════════════════════════════════════════ */
  const applyZoomTransform = useCallback((animate = false) => {
    const el = zoomWrapperRef.current;
    if (!el) return;
    el.style.transition = animate
      ? "transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)"
      : "none";
    el.style.transform = `translate(${zoomTx.current}px, ${zoomTy.current}px) scale(${zoomScale.current})`;
  }, []);

  const getContainerRect = useCallback(() => {
    const el = imageContainerRef.current;
    if (!el) return { w: window.innerWidth, h: window.innerHeight, cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }, []);

  const clampTranslate = useCallback((tx: number, ty: number, s: number) => {
    const { w, h } = getContainerRect();
    const maxTx = Math.max(0, (s - 1) * w / 2);
    const maxTy = Math.max(0, (s - 1) * h / 2);
    return {
      tx: Math.max(-maxTx, Math.min(maxTx, tx)),
      ty: Math.max(-maxTy, Math.min(maxTy, ty)),
    };
  }, [getContainerRect]);

  const resetZoom = useCallback((animate = true) => {
    zoomScale.current = 1;
    zoomTx.current = 0;
    zoomTy.current = 0;
    applyZoomTransform(animate);
  }, [applyZoomTransform]);

  const isZoomed = () => zoomScale.current > 1.02;

  /* ════════════════════════════════════════════════
     NAVIGATION
     ════════════════════════════════════════════════ */
  const slideTo = useCallback((newIndex: number, direction: "left" | "right") => {
    if (isAnimating) return;
    if (newIndex < 0 || newIndex >= total) return;
    setIsAnimating(true);
    setSlideDirection(direction);
    setTimeout(() => {
      setCurrentIndex(newIndex);
      setSlideDirection("none");
      setIsAnimating(false);
    }, SLIDE_DURATION);
  }, [isAnimating, total]);

  const goNext = useCallback(() => {
    if (currentIndex < total - 1) slideTo(currentIndex + 1, "left");
  }, [currentIndex, total, slideTo]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) slideTo(currentIndex - 1, "right");
  }, [currentIndex, slideTo]);

  /* Keyboard */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isZoomed()) { resetZoom(); return; }
        onClose();
      }
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goNext, goPrev, resetZoom]);

  /* Lock body scroll */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* Reset expanded + zoom when changing image */
  useEffect(() => {
    setExpanded(false);
    zoomScale.current = 1;
    zoomTx.current = 0;
    zoomTy.current = 0;
    const el = zoomWrapperRef.current;
    if (el) {
      el.style.transition = "none";
      el.style.transform = "translate(0px, 0px) scale(1)";
    }
  }, [currentIndex]);

  /* ════════════════════════════════════════════════
     DOUBLE-TAP HANDLER
     ════════════════════════════════════════════════ */
  const handleDoubleTap = useCallback((sx: number, sy: number) => {
    const { cx, cy } = getContainerRect();
    if (isZoomed()) {
      // Zoom out to 1x
      zoomScale.current = 1;
      zoomTx.current = 0;
      zoomTy.current = 0;
    } else {
      // Zoom in to DOUBLE_TAP_ZOOM centered on tap point
      const s1 = zoomScale.current;
      const s2 = DOUBLE_TAP_ZOOM;
      const ratio = s2 / s1;
      const newTx = (sx - cx) * (1 - ratio) + zoomTx.current * ratio;
      const newTy = (sy - cy) * (1 - ratio) + zoomTy.current * ratio;
      zoomScale.current = s2;
      const clamped = clampTranslate(newTx, newTy, s2);
      zoomTx.current = clamped.tx;
      zoomTy.current = clamped.ty;
    }
    applyZoomTransform(true);
  }, [getContainerRect, clampTranslate, applyZoomTransform]);

  /* ════════════════════════════════════════════════
     TOUCH HANDLERS
     ════════════════════════════════════════════════ */

  /* ── Swipe transforms (non-zoom, existing logic) ── */
  const applySwipeTransform = () => {
    const el = imageContainerRef.current;
    const bd = backdropRef.current;
    const track = trackRef.current;
    if (!el) return;

    if (axis.current === "y") {
      const dy = dragY.current;
      const absY = Math.abs(dy);
      const opacity = Math.max(0, 1 - absY / DISMISS_OPACITY_RANGE);
      const scale = Math.max(0.85, 1 - absY / 1500);
      el.style.transform = `translateY(${dy}px) scale(${scale})`;
      el.style.transition = "none";
      if (bd) {
        bd.style.background = `rgba(0,0,0,${opacity})`;
        bd.style.transition = "none";
      }
    } else if (axis.current === "x" && track) {
      let dx = dragX.current;
      if ((currentIndex === 0 && dx > 0) || (currentIndex === total - 1 && dx < 0)) {
        dx = dx * 0.25;
      }
      track.style.transform = `translateX(${dx}px)`;
      track.style.transition = "none";
    }
  };

  const resetVertical = (animate = true) => {
    const el = imageContainerRef.current;
    const bd = backdropRef.current;
    if (!el) return;
    if (animate) {
      el.style.transition = "transform 0.3s ease";
      if (bd) bd.style.transition = "background 0.3s ease";
    }
    el.style.transform = "translateY(0) scale(1)";
    if (bd) bd.style.background = "rgba(0,0,0,1)";
  };

  /* ── Main touch handlers ── */
  const onTouchStart = (e: React.TouchEvent) => {
    if (isAnimating) return;

    // ── 2 fingers → pinch ──
    if (e.touches.length === 2) {
      isDragging.current = false;
      isPanning.current = false;
      isPinching.current = true;

      const dist = getDistance(e.touches[0], e.touches[1]);
      const mid = getMidpoint(e.touches[0], e.touches[1]);
      pinchStartDist.current = dist;
      pinchStartScale.current = zoomScale.current;
      pinchStartTx.current = zoomTx.current;
      pinchStartTy.current = zoomTy.current;
      pinchMidX.current = mid.x;
      pinchMidY.current = mid.y;
      return;
    }

    // ── 1 finger ──
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStartX.current = t.clientX;
      touchStartY.current = t.clientY;
      touchStartTime.current = Date.now();

      if (isZoomed()) {
        // Pan mode
        isPanning.current = true;
        isDragging.current = false;
        panStartX.current = t.clientX;
        panStartY.current = t.clientY;
        panStartTx.current = zoomTx.current;
        panStartTy.current = zoomTy.current;
      } else {
        // Normal swipe/dismiss
        isDragging.current = true;
        isPanning.current = false;
        dragX.current = 0;
        dragY.current = 0;
        axis.current = "none";
        const track = trackRef.current;
        if (track) track.style.transition = "none";
      }
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (isAnimating) return;

    // ── Pinching (2 fingers) ──
    if (isPinching.current && e.touches.length >= 2) {
      const newDist = getDistance(e.touches[0], e.touches[1]);
      const mid = getMidpoint(e.touches[0], e.touches[1]);
      const { cx, cy } = getContainerRect();

      // Calculate new scale (allow slight overshoot below 1 for rubber-band feel)
      const ratio = newDist / pinchStartDist.current;
      let newScale = pinchStartScale.current * ratio;
      // Rubber-band beyond limits
      if (newScale < MIN_ZOOM) {
        newScale = MIN_ZOOM - (MIN_ZOOM - newScale) * 0.4;
      } else if (newScale > MAX_ZOOM) {
        newScale = MAX_ZOOM + (newScale - MAX_ZOOM) * 0.2;
      }

      // Keep the initial pinch midpoint fixed on screen
      const scaleRatio = newScale / pinchStartScale.current;
      let newTx = (pinchMidX.current - cx) * (1 - scaleRatio) + pinchStartTx.current * scaleRatio;
      let newTy = (pinchMidY.current - cy) * (1 - scaleRatio) + pinchStartTy.current * scaleRatio;

      // Also allow finger movement to pan during pinch
      const midDx = mid.x - pinchMidX.current;
      const midDy = mid.y - pinchMidY.current;
      newTx += midDx;
      newTy += midDy;

      zoomScale.current = newScale;
      zoomTx.current = newTx;
      zoomTy.current = newTy;
      applyZoomTransform(false);
      return;
    }

    // ── Panning (1 finger, zoomed) ──
    if (isPanning.current && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - panStartX.current;
      const dy = t.clientY - panStartY.current;
      const newTx = panStartTx.current + dx;
      const newTy = panStartTy.current + dy;
      const clamped = clampTranslate(newTx, newTy, zoomScale.current);
      zoomTx.current = clamped.tx;
      zoomTy.current = clamped.ty;
      applyZoomTransform(false);
      return;
    }

    // ── Normal drag (swipe/dismiss, zoom=1) ──
    if (isDragging.current && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - touchStartX.current;
      const dy = t.clientY - touchStartY.current;

      if (axis.current === "none") {
        if (Math.abs(dx) > AXIS_LOCK_PX || Math.abs(dy) > AXIS_LOCK_PX) {
          axis.current = Math.abs(dy) > Math.abs(dx) ? "y" : "x";
        } else {
          return;
        }
      }

      if (axis.current === "x") dragX.current = dx;
      else dragY.current = dy;
      applySwipeTransform();
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (isAnimating) return;

    // ── Pinch ended ──
    if (isPinching.current) {
      // If still have 1 finger remaining, transition to pan
      if (e.touches.length === 1) {
        isPinching.current = false;
        // Snap scale to limits
        if (zoomScale.current < MIN_ZOOM) {
          resetZoom(true);
          return;
        }
        if (zoomScale.current > MAX_ZOOM) {
          zoomScale.current = MAX_ZOOM;
          const clamped = clampTranslate(zoomTx.current, zoomTy.current, MAX_ZOOM);
          zoomTx.current = clamped.tx;
          zoomTy.current = clamped.ty;
          applyZoomTransform(true);
        }
        // Set up pan from remaining finger
        if (isZoomed()) {
          isPanning.current = true;
          const t = e.touches[0];
          panStartX.current = t.clientX;
          panStartY.current = t.clientY;
          panStartTx.current = zoomTx.current;
          panStartTy.current = zoomTy.current;
        }
        return;
      }

      // All fingers lifted
      isPinching.current = false;
      if (zoomScale.current < MIN_ZOOM) {
        resetZoom(true);
      } else if (zoomScale.current > MAX_ZOOM) {
        zoomScale.current = MAX_ZOOM;
        const clamped = clampTranslate(zoomTx.current, zoomTy.current, MAX_ZOOM);
        zoomTx.current = clamped.tx;
        zoomTy.current = clamped.ty;
        applyZoomTransform(true);
      } else {
        // Clamp translate within bounds
        const clamped = clampTranslate(zoomTx.current, zoomTy.current, zoomScale.current);
        if (clamped.tx !== zoomTx.current || clamped.ty !== zoomTy.current) {
          zoomTx.current = clamped.tx;
          zoomTy.current = clamped.ty;
          applyZoomTransform(true);
        }
      }
      return;
    }

    // ── Pan ended ──
    if (isPanning.current) {
      isPanning.current = false;
      // Check if it was a tap (for double-tap detection)
      const dx = Math.abs((e.changedTouches[0]?.clientX ?? 0) - touchStartX.current);
      const dy = Math.abs((e.changedTouches[0]?.clientY ?? 0) - touchStartY.current);
      const elapsed = Date.now() - touchStartTime.current;
      if (dx < 10 && dy < 10 && elapsed < 300) {
        // It was a tap while zoomed — check double-tap
        const now = Date.now();
        const tapX = e.changedTouches[0]?.clientX ?? 0;
        const tapY = e.changedTouches[0]?.clientY ?? 0;
        const timeDiff = now - lastTapTime.current;
        const distDiff = Math.sqrt(
          (tapX - lastTapX.current) ** 2 + (tapY - lastTapY.current) ** 2
        );
        if (timeDiff < DOUBLE_TAP_DELAY && distDiff < DOUBLE_TAP_DIST) {
          handleDoubleTap(tapX, tapY);
          lastTapTime.current = 0;
          return;
        }
        lastTapTime.current = now;
        lastTapX.current = tapX;
        lastTapY.current = tapY;
      }
      // Clamp
      const clamped = clampTranslate(zoomTx.current, zoomTy.current, zoomScale.current);
      if (clamped.tx !== zoomTx.current || clamped.ty !== zoomTy.current) {
        zoomTx.current = clamped.tx;
        zoomTy.current = clamped.ty;
        applyZoomTransform(true);
      }
      return;
    }

    // ── Normal drag ended (swipe/dismiss) ──
    if (isDragging.current) {
      isDragging.current = false;
      const elapsed = Date.now() - touchStartTime.current;
      const track = trackRef.current;

      if (axis.current === "y") {
        if (Math.abs(dragY.current) > SWIPE_Y_CLOSE_THRESHOLD) {
          const el = imageContainerRef.current;
          const bd = backdropRef.current;
          if (el) {
            const direction = dragY.current > 0 ? 1 : -1;
            el.style.transition = "transform 0.25s ease, opacity 0.25s ease";
            el.style.transform = `translateY(${direction * 400}px) scale(0.8)`;
            el.style.opacity = "0";
          }
          if (bd) {
            bd.style.transition = "background 0.25s ease";
            bd.style.background = "rgba(0,0,0,0)";
          }
          setTimeout(onClose, 250);
          axis.current = "none";
          dragX.current = 0;
          dragY.current = 0;
          return;
        }
        resetVertical(true);
      } else if (axis.current === "x" && track) {
        const absDx = Math.abs(dragX.current);
        const velocity = absDx / Math.max(elapsed, 1);
        const didSwipe = absDx > SWIPE_X_THRESHOLD || (velocity > 0.4 && absDx > 15);

        if (didSwipe && dragX.current < 0 && currentIndex < total - 1) {
          const containerWidth = track.parentElement?.clientWidth || window.innerWidth;
          track.style.transition = `transform ${SLIDE_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
          track.style.transform = `translateX(${-containerWidth}px)`;
          setIsAnimating(true);
          setTimeout(() => {
            setCurrentIndex((i) => Math.min(i + 1, total - 1));
            track.style.transition = "none";
            track.style.transform = "translateX(0)";
            setIsAnimating(false);
          }, SLIDE_DURATION);
        } else if (didSwipe && dragX.current > 0 && currentIndex > 0) {
          const containerWidth = track.parentElement?.clientWidth || window.innerWidth;
          track.style.transition = `transform ${SLIDE_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
          track.style.transform = `translateX(${containerWidth}px)`;
          setIsAnimating(true);
          setTimeout(() => {
            setCurrentIndex((i) => Math.max(i - 1, 0));
            track.style.transition = "none";
            track.style.transform = "translateX(0)";
            setIsAnimating(false);
          }, SLIDE_DURATION);
        } else {
          track.style.transition = `transform ${SLIDE_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
          track.style.transform = "translateX(0)";
        }
      }

      // ── Double-tap detection (from normal 1-finger, not zoomed) ──
      const wasTap = axis.current === "none" && Math.abs(dragX.current) < 5 && Math.abs(dragY.current) < 5 && elapsed < 300;
      if (wasTap || (axis.current === "none" && elapsed < 250)) {
        const now = Date.now();
        const tapX = e.changedTouches[0]?.clientX ?? touchStartX.current;
        const tapY = e.changedTouches[0]?.clientY ?? touchStartY.current;
        const timeDiff = now - lastTapTime.current;
        const distDiff = Math.sqrt(
          (tapX - lastTapX.current) ** 2 + (tapY - lastTapY.current) ** 2
        );

        if (timeDiff < DOUBLE_TAP_DELAY && distDiff < DOUBLE_TAP_DIST) {
          // Clear any pending single-tap action
          if (tapTimeout.current) {
            clearTimeout(tapTimeout.current);
            tapTimeout.current = null;
          }
          handleDoubleTap(tapX, tapY);
          lastTapTime.current = 0;
          axis.current = "none";
          dragX.current = 0;
          dragY.current = 0;
          return;
        }
        lastTapTime.current = now;
        lastTapX.current = tapX;
        lastTapY.current = tapY;

        // Delay single-tap action to wait for potential double-tap
        if (tapTimeout.current) clearTimeout(tapTimeout.current);
        tapTimeout.current = setTimeout(() => {
          tapTimeout.current = null;
          // Single tap: collapse expanded text
          if (expanded) setExpanded(false);
        }, DOUBLE_TAP_DELAY);
      }

      axis.current = "none";
      dragX.current = 0;
      dragY.current = 0;
    }
  };

  /* ─── Truncate description for collapsed state ─── */
  const maxChars = 90;
  const needsTruncation = data.description.length > maxChars;
  const truncatedText = needsTruncation
    ? data.description.slice(0, maxChars).trimEnd() + "..."
    : data.description;

  /* ─── Adjacent images for 3-panel track ─── */
  const prevImage = currentIndex > 0 ? data.images[currentIndex - 1] : null;
  const nextImage = currentIndex < total - 1 ? data.images[currentIndex + 1] : null;

  /* ─── Slide animation for button navigation ─── */
  const getSlideStyle = (): React.CSSProperties => {
    if (slideDirection === "none") return {};
    return {
      animation: `slide-${slideDirection} ${SLIDE_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
    };
  };

  /* ─── Hide header/footer when zoomed ─── */
  // Force re-render awareness of zoom state for UI hiding
  const [, forceRender] = useState(0);
  const prevZoomedRef = useRef(false);
  useEffect(() => {
    const interval = setInterval(() => {
      const nowZoomed = zoomScale.current > 1.02;
      if (nowZoomed !== prevZoomedRef.current) {
        prevZoomedRef.current = nowZoomed;
        forceRender((n) => n + 1);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);
  const showChrome = !prevZoomedRef.current;

  return (
    <div
      ref={backdropRef}
      data-no-swipe
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ background: "rgba(0,0,0,1)" }}
    >
      {/* Slide animation keyframes */}
      <style>{`
        @keyframes slide-left {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(-30%); opacity: 0; }
        }
        @keyframes slide-right {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(30%); opacity: 0; }
        }
      `}</style>

      {/* ═══ Header bar ═══ */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pb-8 pointer-events-none"
        style={{
          paddingTop: "calc(max(env(safe-area-inset-top), 12px) + 6px)",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)",
          opacity: showChrome ? 1 : 0,
          transition: "opacity 0.25s ease",
        }}
      >
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full active:bg-white/20 transition-colors pointer-events-auto"
          aria-label="Cerrar"
          style={{ pointerEvents: showChrome ? "auto" : "none" }}
        >
          <X className="w-6 h-6 text-white" strokeWidth={2} />
        </button>

        {hasMultiple && (
          <span className="text-white text-[15px] tabular-nums">
            {currentIndex + 1} de {total}
          </span>
        )}

        <div className="w-10" />
      </div>

      {/* ═══ Image area (gesture surface) ═══ */}
      <div
        ref={imageContainerRef}
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ willChange: "transform", touchAction: "none" }}
      >
        {/* Dim overlay when text expanded */}
        {expanded && (
          <div className="absolute inset-0 bg-black/50 z-10 transition-opacity duration-300" />
        )}

        {/* ── 3-panel track for horizontal swiping ── */}
        <div
          ref={trackRef}
          className="flex items-center"
          style={{
            width: "100%",
            height: "100%",
            willChange: "transform",
            ...(slideDirection !== "none" ? getSlideStyle() : {}),
          }}
        >
          {/* Previous image (off-screen left) */}
          {prevImage && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: "translateX(-100%)" }}
            >
              <ImageWithFallback
                src={prevImage}
                alt={`${data.title} — ${currentIndex}`}
                className="w-full h-full object-contain select-none pointer-events-none"
                draggable={false}
              />
            </div>
          )}

          {/* Current image — zoom wrapper */}
          <div
            ref={zoomWrapperRef}
            className="w-full h-full flex items-center justify-center"
            style={{
              transformOrigin: "center center",
              willChange: "transform",
            }}
          >
            <ImageWithFallback
              src={data.images[currentIndex]}
              alt={`${data.title} — ${currentIndex + 1}`}
              className="w-full h-full object-contain select-none pointer-events-none"
              draggable={false}
            />
          </div>

          {/* Next image (off-screen right) */}
          {nextImage && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: "translateX(100%)" }}
            >
              <ImageWithFallback
                src={nextImage}
                alt={`${data.title} — ${currentIndex + 2}`}
                className="w-full h-full object-contain select-none pointer-events-none"
                draggable={false}
              />
            </div>
          )}
        </div>

        {/* Desktop navigation arrows */}
        {hasMultiple && currentIndex > 0 && showChrome && (
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 active:bg-black/60 transition-colors"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-6 h-6 text-white" strokeWidth={2} />
          </button>
        )}
        {hasMultiple && currentIndex < total - 1 && showChrome && (
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 active:bg-black/60 transition-colors"
            aria-label="Siguiente"
          >
            <ChevronRight className="w-6 h-6 text-white" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* ═══ Footer overlay — title + timestamp + description ═══ */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-5 pt-16"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)",
          opacity: showChrome ? 1 : 0,
          transition: "opacity 0.25s ease",
          pointerEvents: showChrome ? "auto" : "none",
        }}
      >
        <h2 className="text-white text-[17px] mb-0.5">{data.title}</h2>
        <p className="text-[#8E8E93] text-[13px] mb-2">{formatHumanTimestamp(data.timestamp)}</p>

        <div>
          {expanded ? (
            <>
              <p className="text-white/90 text-[14px] leading-relaxed">{data.description}</p>
              <button
                onClick={() => setExpanded(false)}
                className="text-[#BC955B] text-[14px] mt-1 active:opacity-70"
              >
                Ver menos
              </button>
            </>
          ) : (
            <p className="text-white/90 text-[14px] leading-relaxed">
              {truncatedText}
              {needsTruncation && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-[#BC955B] text-[14px] ml-1 active:opacity-70"
                >
                  Ver más
                </button>
              )}
            </p>
          )}
        </div>

        {hasMultiple && (
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {data.images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`rounded-full transition-all ${
                  i === currentIndex
                    ? "w-2 h-2 bg-white"
                    : "w-1.5 h-1.5 bg-white/40"
                }`}
                aria-label={`Imagen ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}