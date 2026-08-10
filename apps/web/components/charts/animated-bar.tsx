"use client";

import { useEffect, useState } from "react";

export function AnimatedBar({
  percent,
  color = "var(--accent)",
  trackClassName = "",
  className = "",
  height = 8,
}: {
  percent: number;
  color?: string;
  trackClassName?: string;
  className?: string;
  height?: number;
}) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`overflow-hidden rounded-full bg-(--surface-2) ${trackClassName}`}
      style={{ height }}
    >
      <div
        className={`h-full rounded-full ${className}`}
        style={{
          background: color,
          width: grown ? `${Math.max(0, Math.min(100, percent))}%` : "0%",
          transition: "width 1.1s cubic-bezier(0.16,1,0.3,1)",
        }}
      />
    </div>
  );
}
