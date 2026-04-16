import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Bell, CheckCheck, Check, ShieldAlert, AlertTriangle, Info } from "lucide-react";
import { useState } from "react";

interface Props {
  orgId: Id<"organisations">;
}

const SEVERITY_CONFIG = {
  CRITICAL: { bg: "bg-accent/10", border: "border-accent/30", text: "text-accent", icon: ShieldAlert },
  HIGH: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", icon: AlertTriangle },
  MEDIUM: { bg: "bg-warning/10", border: "border-warning/30", text: "text-warning", icon: AlertTriangle },
  LOW: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", icon: Info },
};

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString("en-ZA");
}

export default function Alerts({ orgId }: Props) {
  const alerts = useQuery(api.alerts.list, { organisationId: orgId, limit: 200 });
  const markRead = useMutation(api.alerts.markRead);
  const markResolved = useMutation(api.alerts.markResolved);
  const markAllRead = useMutation(api.alerts.markAllRead);
  const [filter, setFilter] = useState<string>("ALL");
  const [showResolved, setShowResolved] = useState(false);

  const filtered = alerts?.filter((a) => {
    const matchSeverity = filter === "ALL" || a.severity === filter;
    const matchResolved = showResolved ? true : !a.isResolved;
    return matchSeverity && matchResolved;
  });

  const unread = alerts?.filter((a) => !a.isRead).length ?? 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Alert Centre</h1>
          <p className="text-navy-400 text-sm mt-0.5">
            {unread > 0 ? `${unread} unread alerts` : "All alerts read"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={`px-3 py-2 rounded text-xs font-semibold border transition-colors ${
              showResolved ? "bg-navy-700 border-navy-600 text-navy-200" : "bg-navy-800 border-navy-700 text-navy-400"
            }`}
          >
            {showResolved ? "Hide Resolved" : "Show Resolved"}
          </button>
          {unread > 0 && (
            <button
              onClick={() => markAllRead({ organisationId: orgId })}
              className="flex items-center gap-1.5 px-3 py-2 bg-navy-800 border border-navy-700 text-navy-300 text-xs rounded hover:bg-navy-700 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Severity filters */}
      <div className="flex gap-2 flex-wrap">
        {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((s) => {
          const count = s === "ALL" ? alerts?.length : alerts?.filter((a) => a.severity === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                filter === s
                  ? s === "CRITICAL" ? "bg-accent border-accent text-white"
                  : s === "HIGH" ? "bg-orange-500 border-orange-500 text-white"
                  : s === "MEDIUM" ? "bg-warning border-warning text-white"
                  : s === "LOW" ? "bg-blue-500 border-blue-500 text-white"
                  : "bg-navy-700 border-navy-600 text-white"
                  : "bg-navy-800 border-navy-700 text-navy-400 hover:text-navy-200"
              }`}
            >
              {s} {count !== undefined && <span className="opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Alerts list */}
      <div className="space-y-2">
        {filtered?.length === 0 && (
          <div className="text-center py-16 text-navy-500">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No alerts found</p>
          </div>
        )}
        {filtered?.map((alert) => {
          const cfg = SEVERITY_CONFIG[alert.severity];
          const Icon = cfg.icon;
          return (
            <div
              key={alert._id}
              className={`flex items-start gap-4 p-4 rounded-container border transition-all ${cfg.bg} ${cfg.border} ${
                !alert.isRead ? "opacity-100" : "opacity-60"
              } ${alert.isResolved ? "opacity-40" : ""}`}
            >
              <div className={`p-2 rounded ${cfg.bg} shrink-0`}>
                <Icon className={`w-4 h-4 ${cfg.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold ${cfg.text}`}>{alert.title}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                    {alert.severity}
                  </span>
                  {!alert.isRead && (
                    <span className="w-2 h-2 rounded-full bg-accent" />
                  )}
                  {alert.isResolved && (
                    <span className="text-xs px-1.5 py-0.5 bg-safe/10 border border-safe/20 text-safe rounded">
                      RESOLVED
                    </span>
                  )}
                </div>
                <p className="text-navy-300 text-sm mt-1">{alert.description}</p>
                <p className="text-navy-500 text-xs mt-1">{timeAgo(alert._creationTime)}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {!alert.isRead && (
                  <button
                    onClick={() => markRead({ alertId: alert._id })}
                    className="p-1.5 rounded bg-navy-700 hover:bg-navy-600 text-navy-400 hover:text-navy-200 transition-colors"
                    title="Mark as read"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
                {!alert.isResolved && (
                  <button
                    onClick={() => markResolved({ alertId: alert._id })}
                    className="p-1.5 rounded bg-safe/10 hover:bg-safe/20 text-safe transition-colors"
                    title="Mark as resolved"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

