"use client";

import { useEffect, useId, useState } from "react";
import { linePoints, smoothPath } from "./chart-utils";

export interface AreaChartPoint {
  value: number;
  label: string;
}

export function AreaChart({
  data,
  color = "var(--teal)",
  width = 700,
  height = 180,
}: {
  data: AreaChartPoint[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const gid = useId();
  const [drawn, setDrawn] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-(--sub)">Not enough history yet.</p>;
  }

  const padX = 8;
  const padY = 14;
  const values = data.map((d) => d.value);
  const pts = linePoints(values, width, height, padX, padY);
  const line = smoothPath(pts);
  const area = line + ` L${pts[pts.length - 1]![0]},${height - padY} L${pts[0]![0]},${height - padY} Z`;
  const last = pts[pts.length - 1]!;
  const len = 3000;

  return (
    <div className="relative w-full overflow-hidden">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => {
          const y = padY + ((height - padY * 2) / 3) * i;
          return <line key={i} x1={padX} x2={width - padX} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" />;
        })}
        <path
          d={area}
          fill={`url(#${gid})`}
          stroke="none"
          style={{ opacity: drawn ? 1 : 0, transition: "opacity 1s ease 0.3s" }}
        />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: len,
            strokeDashoffset: drawn ? 0 : len,
            transition: "stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
        <circle cx={last[0]} cy={last[1]} r="4" fill={color} />
        <circle cx={last[0]} cy={last[1]} r="7" fill="none" stroke={color} strokeWidth="1.25" opacity="0.4" />
        <text x={last[0] - 4} y={last[1] - 12} textAnchor="end" fill="var(--sub)" fontSize="11" fontFamily="ui-monospace, monospace">
          {values[values.length - 1]}
        </text>
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p[0]}
            cy={p[1]}
            r="9"
            fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
          />
        ))}
      </svg>
      {hover !== null ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[120%] whitespace-nowrap rounded-md bg-(--ink) px-2 py-1 text-xs font-semibold text-(--bg)"
          style={{ left: `${(pts[hover]![0] / width) * 100}%`, top: `${(pts[hover]![1] / height) * 100}%` }}
        >
          <div>{data[hover]!.value}</div>
          <div className="text-[10px] font-normal opacity-70">{data[hover]!.label}</div>
        </div>
      ) : null}
    </div>
  );
}
