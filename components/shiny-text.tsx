"use client";

import { CSSProperties, ReactNode } from "react";

type ShinyTextProps = {
  text: string;
  className?: string;
  color?: string;
  shineColor?: string;
  speed?: number;
  delay?: number;
  spread?: number;
  direction?: "left" | "right";
  disabled?: boolean;
};

export function ShinyText({
  text,
  className = "",
  color = "#b5b5b5",
  shineColor = "#ffffff",
  speed = 2,
  delay = 0,
  spread = 120,
  direction = "left",
  disabled = false,
}: ShinyTextProps) {
  const gradient = `linear-gradient(${direction === "left" ? "120deg" : "60deg"}, transparent 0%, transparent 40%, ${shineColor} 50%, transparent 60%, transparent 100%)`;

  const overlayStyle: CSSProperties = {
    backgroundImage: gradient,
    backgroundSize: "200% 100%",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    color: "transparent",
    WebkitTextFillColor: "transparent",
    animation: disabled ? "none" : `shimmer ${speed}s linear ${delay}s infinite`,
    position: "absolute",
    left: 0,
    top: 0,
    whiteSpace: "pre",
    pointerEvents: "none",
  };

  const containerStyle: CSSProperties = {
    position: "relative",
    display: "inline-block",
    lineHeight: 1,
  };

  const baseStyle: CSSProperties = {
    color,
    WebkitTextFillColor: color,
  };

  return (
    <span className={className} style={containerStyle} aria-hidden={disabled ? "true" : "false"}>
      <span style={baseStyle}>{text}</span>
      {!disabled && (
        <span style={overlayStyle} className="shiny-overlay">
          {text}
        </span>
      )}
    </span>
  );
}
