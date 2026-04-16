import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: "blue" | "red" | "green" | "amber";
  trend?: string;
}

const colorMap = {
  blue: { icon: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  red: { icon: "text-accent", bg: "bg-accent/10", border: "border-accent/20" },
  green: { icon: "text-safe", bg: "bg-safe/10", border: "border-safe/20" },
  amber: { icon: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
};

export default function StatCard({ title, value, subtitle, icon: Icon, color = "blue", trend }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className={`bg-navy-900 border ${c.border} rounded-container p-5 fade-in-up`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-navy-400 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-navy-500 text-xs mt-1">{subtitle}</p>}
          {trend && <p className="text-safe text-xs mt-1">{trend}</p>}
        </div>
        <div className={`p-2.5 rounded-container ${c.bg}`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
      </div>
    </div>
  );
}

