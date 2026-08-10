export type PillTone = "sub" | "accent" | "teal" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<PillTone, string> = {
  sub: "bg-(--surface-2) text-(--sub)",
  accent: "bg-(--accent-fill) text-(--accent)",
  teal: "bg-(--teal-fill) text-(--teal)",
  success: "bg-(--success-fill) text-(--success)",
  warning: "bg-(--warning-fill) text-(--warning)",
  danger: "bg-(--danger-fill) text-(--danger)",
};

export function Pill({
  tone = "sub",
  children,
  className = "",
}: {
  tone?: PillTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
