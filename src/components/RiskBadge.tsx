interface RiskBadgeProps {
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  score?: number;
  size?: "sm" | "md";
}

const config = {
  LOW: { bg: "bg-safe/10", text: "text-safe", border: "border-safe/20", dot: "bg-safe" },
  MEDIUM: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/20", dot: "bg-warning" },
  HIGH: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20", dot: "bg-orange-400" },
  CRITICAL: { bg: "bg-accent/10", text: "text-accent", border: "border-accent/20", dot: "bg-accent" },
};

export default function RiskBadge({ level, score, size = "md" }: RiskBadgeProps) {
  const c = config[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-semibold ${c.bg} ${c.text} ${c.border} ${size === "sm" ? "text-xs" : ""}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {level}
      {score !== undefined && <span className="opacity-70">({score})</span>}
    </span>
  );
}

