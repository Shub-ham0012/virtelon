export function scoreColorClass(score: number): string {
  if (score >= 70) return "text-green-600 dark:text-green-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-(--danger)";
}

export function ScoreBadge({ score, size = "sm" }: { score: number | null; size?: "sm" | "lg" }) {
  if (score === null) return <span className="text-sm text-(--sub)">—</span>;
  return (
    <span className={`font-semibold tabular-nums ${size === "lg" ? "text-2xl" : ""} ${scoreColorClass(score)}`}>
      {score}
    </span>
  );
}
