"use client";

import { useRef, useEffect, useCallback } from "react";

interface RulerProps {
  /** Pixel offset from the left edge of the ruler to the 0 mark (matches editor text padding) */
  leftOffset?: number;
}

export function Ruler({ leftOffset = 48 }: RulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = 20;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas (transparent background)
    ctx.clearRect(0, 0, width, height);

    // Determine range in px: from -leftOffset to (width - leftOffset)
    const startPx = -leftOffset;
    const endPx = width - leftOffset;

    // Round to nearest 10
    const firstTick = Math.ceil(startPx / 10) * 10;

    const isDark = window.document.documentElement.classList.contains("dark");
    const tickColor = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)";
    const majorTickColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";
    const labelColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)";
    const zeroColor = isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.7)";

    ctx.textBaseline = "top";
    ctx.font = "9px -apple-system, BlinkMacSystemFont, sans-serif";

    for (let px = firstTick; px <= endPx; px += 10) {
      const x = px + leftOffset; // canvas x position

      const isMajor = px % 100 === 0;
      const isMid = px % 50 === 0;
      const isZero = px === 0;

      // Tick height
      let tickH: number;
      if (isMajor) tickH = 10;
      else if (isMid) tickH = 7;
      else tickH = 4;

      // Draw tick
      ctx.fillStyle = isZero ? zeroColor : isMajor ? majorTickColor : tickColor;
      ctx.fillRect(x, height - tickH, 1, tickH);

      // Label at major ticks
      if (isMajor) {
        ctx.fillStyle = isZero ? zeroColor : labelColor;
        const label = String(px);
        const labelWidth = ctx.measureText(label).width;
        ctx.fillText(label, x - labelWidth / 2, 2);
      }
    }

    // Bottom border line
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
    ctx.fillRect(0, height - 1, width, 1);
  }, [leftOffset]);

  useEffect(() => {
    draw();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  return (
    <div className="-order-1 bg-muted/30 border-b">
      <canvas
        ref={canvasRef}
        className="w-full block"
        style={{ height: 20 }}
      />
    </div>
  );
}
