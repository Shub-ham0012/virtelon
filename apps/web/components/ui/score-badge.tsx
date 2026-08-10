import type { PillTone } from "./pill";

export function scoreTone(score: number): PillTone {
  if (score >= 75) return "success";
  if (score >= 50) return "accent";
  return "sub";
}

export function scoreColorClass(score: number): string {
  if (score >= 75) return "text-(--success)";
  if (score >= 50) return "text-(--accent)";
  return "text-(--sub)";
}

const TONE_CLASSES: Record<PillTone, string> = {
  sub: "bg-(--surface-2) text-(--sub)",
  accent: "bg-(--accent-fill) text-(--accent)",
  teal: "bg-(--teal-fill) text-(--teal)",
  success: "bg-(--success-fill) text-(--success)",
  warning: "bg-(--warning-fill) text-(--warning)",
  danger: "bg-(--danger-fill) text-(--danger)",
};

export function ScoreBadge({ score, size = "sm" }: { score: number | null; size?: "sm" | "lg" }) {
  if (score === null) return <span className="text-sm text-(--sub)">—</span>;

  if (size === "lg") {
    return <span className={`font-mono-data text-2xl font-bold tabular-nums ${scoreColorClass(score)}`}>{score}</span>;
  }

  return (
    <span
      className={`inline-flex min-w-[34px] items-center justify-center rounded-md px-1.5 py-0.5 font-mono-data text-xs font-bold tabular-nums ${TONE_CLASSES[scoreTone(score)]}`}
    >
      {score}
    </span>
  );
}
