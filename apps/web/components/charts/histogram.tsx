"use client";

import { useEffect, useState } from "react";

export interface HistogramBucket {
  label: string;
  value: number;
  color: string;
}

export function Histogram({ buckets, height = 130 }: { buckets: HistogramBucket[]; height?: number }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 80);
    return () => clearTimeout(t);
  }, []);

  const max = Math.max(...buckets.map((b) => b.value), 1);

  return (
    <div className="flex items-end gap-2.5 pt-2.5" style={{ height }}>
      {buckets.map((b, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <div className="font-mono-data text-[10.5px] font-bold">{b.value}</div>
          <div
            className="w-full rounded-t"
            style={{
              background: b.color,
              height: grown ? `${Math.round((b.value / max) * 100)}%` : "0%",
              transition: "height 1.1s cubic-bezier(0.16,1,0.3,1)",
            }}
          />
          <div className="text-[9.5px] text-(--sub)">{b.label}</div>
        </div>
      ))}
    </div>
  );
}
