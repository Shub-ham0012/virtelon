"use client";

import { useEffect, useId, useRef, useState } from "react";
import { linePoints, smoothPath } from "./chart-utils";

export function Sparkline({
  data,
  width = 130,
  height = 46,
  color = "var(--accent)",
  className = "",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  const gid = useId();
  const pathRef = useRef<SVGPathElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (data.length === 0) return null;
  const pts = linePoints(data, width, height, 4, 6);
  const line = smoothPath(pts);
  const area = line + ` L${pts[pts.length - 1]![0]},${height} L${pts[0]![0]},${height} Z`;
  const last = pts[pts.length - 1]!;
  const len = 320;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} stroke="none" />
      <path
        ref={pathRef}
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: len,
          strokeDashoffset: drawn ? 0 : len,
          transition: "stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)",
        }}
      />
      <circle cx={last[0]} cy={last[1]} r="2.75" fill={color} />
    </svg>
  );
}
