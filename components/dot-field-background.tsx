"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "./theme-provider";

type PointerState = {
  x: number;
  y: number;
  active: boolean;
};

export function DotFieldBackground() {
  const { resolvedTheme } = useTheme();
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });
  const [pointer, setPointer] = useState<PointerState>({ x: 0, y: 0, active: false });

  const palette = useMemo(() => {
    if (resolvedTheme === "light") {
      return {
        from: "rgba(79, 70, 229, 0.85)",
        to: "rgba(124, 58, 237, 0.5)",
        glowOne: "rgba(79, 70, 229, 0.15)",
        glowTwo: "rgba(124, 58, 237, 0.12)",
      };
    }

    return {
      from: "rgba(129, 140, 248, 0.85)",
      to: "rgba(192, 132, 252, 0.5)",
      glowOne: "rgba(99, 102, 241, 0.16)",
      glowTwo: "rgba(192, 132, 252, 0.16)",
    };
  }, [resolvedTheme]);

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

  const points = useMemo(() => {
    const spacing = resolvedTheme === "light" ? 36 : 28;
    const columns = Math.max(8, Math.ceil(viewport.width / spacing));
    const rows = Math.max(6, Math.ceil(viewport.height / spacing));

    return Array.from({ length: columns * rows }, (_, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      return {
        x: col * spacing + (row % 2 === 0 ? spacing / 2 : 0),
        y: row * spacing,
      };
    });
  }, [viewport.height, viewport.width]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg viewBox={`0 0 ${viewport.width} ${viewport.height}`} className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id={`dot-gradient-${resolvedTheme}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.from} />
            <stop offset="100%" stopColor={palette.to} />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={viewport.width} height={viewport.height} fill="transparent" />

        {points.map((point, index) => {
          const dx = pointer.x - point.x;
          const dy = pointer.y - point.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const radius = 140;
          const influence = pointer.active ? Math.max(0, 1 - distance / radius) : 0;
          const size = 1.3 + influence * 2.6;
          const opacity = 0.16 + influence * 0.65;
          const offsetX = influence * (dx / Math.max(distance, 1)) * 8;
          const offsetY = influence * (dy / Math.max(distance, 1)) * 8;

          return (
            <circle
              key={`${point.x}-${point.y}-${index}`}
              cx={point.x + offsetX}
              cy={point.y + offsetY}
              r={size}
              fill={`url(#dot-gradient-${resolvedTheme})`}
              opacity={opacity}
              style={{ filter: influence > 0.1 ? "blur(0.2px)" : "none" }}
            />
          );
        })}
      </svg>

      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle_at_top_left, ${palette.glowOne}, transparent 45%), radial-gradient(circle_at_bottom_right, ${palette.glowTwo}, transparent 50%)`,
        }}
      />
    </div>
  );
}
