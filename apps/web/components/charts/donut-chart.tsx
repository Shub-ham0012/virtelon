"use client";

import { useEffect, useState } from "react";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  segments,
  centerLabel,
  centerValue,
  size = 110,
}: {
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(raf);
  }, []);

  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.365;
  const sw = size * 0.136;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments.map((seg) => {
    const frac = seg.value / total;
    const dash = frac * circumference;
    const arc = { seg, dash, offset };
    offset += dash;
    return arc;
  });

  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={sw} />
        {arcs.map(({ seg, dash, offset: off }, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={sw}
            strokeDasharray={drawn ? `${dash} ${circumference - dash}` : `0 ${circumference}`}
            strokeDashoffset={-off}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
            style={{ transition: "stroke-dasharray 1.1s cubic-bezier(0.16,1,0.3,1)" }}
          />
        ))}
      </svg>
      {centerValue ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono-data text-lg font-bold">{centerValue}</span>
          {centerLabel ? <span className="text-[8.5px] uppercase tracking-wide text-(--sub)">{centerLabel}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
