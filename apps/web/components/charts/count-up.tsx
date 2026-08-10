"use client";

import { useEffect, useRef, useState } from "react";

function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

export function CountUp({ value, suffix = "", className = "" }: { value: number; suffix?: string; className?: string }) {
  const [display, setDisplay] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    let raf: number;
    const duration = 1100;
    function tick(now: number) {
      if (start.current === null) start.current = now;
      const p = Math.min(1, (now - start.current) / duration);
      setDisplay(Math.round(value * easeOutExpo(p)));
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className={className}>
      {display.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}
