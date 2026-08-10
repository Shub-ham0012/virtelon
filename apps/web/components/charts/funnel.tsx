"use client";

import { AnimatedBar } from "./animated-bar";

export interface FunnelStage {
  name: string;
  count: number;
}

export function Funnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="card flex items-stretch gap-0 px-2.5 py-1">
      {stages.map((stage, i) => {
        const prev = stages[i - 1];
        const conversion = prev && prev.count > 0 ? Math.round((stage.count / prev.count) * 100) : null;
        const widthPercent = 30 + 70 * (stage.count / max);

        return (
          <div
            key={stage.name}
            className={`relative flex min-w-0 flex-1 flex-col gap-1.5 rounded-md px-1.5 py-3.5 transition-colors hover:bg-(--surface-2) ${
              i < stages.length - 1 ? "border-r border-dashed border-(--border)" : ""
            }`}
          >
            {conversion !== null ? (
              <span
                className="absolute z-10 rounded-full border border-(--border) bg-(--surface) px-1.5 py-0.5 text-[10px] font-bold text-(--sub) shadow-(--shadow)"
                style={{ right: "-1px", top: "20px", transform: "translate(50%, -50%)" }}
              >
                {conversion}%
              </span>
            ) : null}
            <div className="text-[11px] uppercase tracking-wide text-(--sub)">{stage.name}</div>
            <div className="font-serif-display text-[22px] font-medium">{stage.count.toLocaleString("en-IN")}</div>
            <AnimatedBar percent={widthPercent} color="linear-gradient(90deg, var(--accent-soft), var(--accent))" />
          </div>
        );
      })}
    </div>
  );
}
