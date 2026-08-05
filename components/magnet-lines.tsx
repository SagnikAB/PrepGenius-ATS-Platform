"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "./theme-provider";

type PointerState = {
  x: number;
  y: number;
  active: boolean;
};

type MagnetLinesProps = {
  rows?: number;
  columns?: number;
  baseAngle?: number;
  lineColor?: string;
  lineWidth?: string;
  lineHeight?: string;
  className?: string;
  style?: React.CSSProperties;
};

export function MagnetLines({
  rows = 10,
  columns = 12,
  baseAngle = -10,
  lineColor,
  lineWidth = "1px",
  lineHeight = "6vmin",
  className = "",
  style,
}: MagnetLinesProps) {
  const { resolvedTheme } = useTheme();
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });
  const [pointer, setPointer] = useState<PointerState>({ x: 0, y: 0, active: false });

  const palette = useMemo(() => {
    if (resolvedTheme === "light") {
      return {
        color: lineColor ?? "rgba(79, 70, 229, 0.65)",
      };
    }

    return {
      color: lineColor ?? "rgba(248, 250, 252, 0.55)",
    };
  }, [lineColor, resolvedTheme]);

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    const handlePointerMove = (event: MouseEvent) => {
      setPointer({ x: event.clientX, y: event.clientY, active: true });
    };

    const handlePointerLeave = () => {
      setPointer((current) => ({ ...current, active: false }));
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseleave", handlePointerLeave);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseleave", handlePointerLeave);
    };
  }, []);

  const lines = useMemo(() => {
    return Array.from({ length: rows * columns }, (_, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const xPercent = ((column + 1) / (columns + 1)) * 100;
      const yPercent = ((row + 1) / (rows + 1)) * 100;
      const dx = pointer.x - (viewport.width * xPercent) / 100;
      const dy = pointer.y - (viewport.height * yPercent) / 100;
      const distance = Math.hypot(dx, dy);
      const influence = pointer.active ? Math.max(0, 1 - distance / 280) : 0;
      const angle = baseAngle + influence * 55;
      const opacity = 0.16 + influence * 0.58;
      const scaleY = 0.75 + influence * 0.35;

      return {
        xPercent,
        yPercent,
        angle,
        opacity,
        scaleY,
      };
    });
  }, [baseAngle, columns, pointer.active, pointer.x, pointer.y, rows, viewport.height, viewport.width]);

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`.trim()}
      style={{ ...style }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 opacity-70" style={{ background: "radial-gradient(circle at top left, rgba(255,255,255,0.08), transparent 44%)" }} />
      {lines.map((line, index) => (
        <span
          key={`${line.xPercent}-${line.yPercent}-${index}`}
          className="absolute block rounded-full"
          style={{
            left: `${line.xPercent}%`,
            top: `${line.yPercent}%`,
            width: lineWidth,
            height: lineHeight,
            background: `linear-gradient(90deg, transparent 0%, ${palette.color} 50%, transparent 100%)`,
            transform: `translate(-50%, -50%) rotate(${line.angle}deg) scaleY(${line.scaleY})`,
            opacity: line.opacity,
            boxShadow: `0 0 10px ${palette.color}`,
          }}
        />
      ))}
    </div>
  );
}
