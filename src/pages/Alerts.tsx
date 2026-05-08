import { supabase } from "../lib/supabase";
import { Bell, CheckCheck, Check, ShieldAlert, AlertTriangle, Info } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  orgId: string;
}

const SEVERITY_CONFIG = {
  CRITICAL: { bg: "bg-accent/10", border: "border-accent/30", text: "text-accent", icon: ShieldAlert },
  HIGH: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", icon: AlertTriangle },
  MEDIUM: { bg: "bg-warning/10", border: "border-warning/30", text: "text-warning", icon: AlertTriangle },
  LOW: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", icon: Info },
};

function timeAgo(dateString: string) {
  const ts = new Date(dateString).getTime();
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString("en-ZA");
}

export default function Alerts({ orgId }: Props) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAlerts() {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) console.error("Error fetching alerts:", error);
      else setAlerts(data || []);
      setLoading(false);
    }

    fetchAlerts();

    // Set up realtime subscription
    const subscription = supabase
      .channel('alerts_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'alerts',
        filter: `organisation_id=eq.${orgId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAlerts(prev => [payload.new, ...prev].slice(0, 200));
        } else if (payload.eventType === 'UPDATE') {
          setAlerts(prev => prev.map(a => a.id === payload.new.id ? payload.new : a));
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [orgId]);

  const markRead = async (id: string) => {
    const { error } = await supabase.from('alerts').update({ is_read: true }).eq('id', id);
    if (error) console.error("Error marking read:", error);
  };

  const markResolved = async (id: string) => {
    const { error } = await supabase.from('alerts').update({ is_read: true, is_resolved: true }).eq('id', id);
    if (error) console.error("Error marking resolved:", error);
  };

  const markAllRead = async () => {
    const { error } = await supabase.from('alerts').update({ is_read: true }).eq('organisation_id', orgId).eq('is_read', false);
    if (error) console.error("Error marking all read:", error);
  };

  const filtered = alerts?.filter((a) => {
    const matchSeverity = filter === "ALL" || a.severity === filter;
    const matchResolved = showResolved ? true : !a.is_resolved;
    return matchSeverity && matchResolved;
  });

  const unreadCount = alerts?.filter((a) => !a.is_read).length ?? 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Alert Centre</h1>
          <p className="text-navy-400 text-sm mt-0.5">
            {loading ? "Loading..." : unreadCount > 0 ? `${unreadCount} unread alerts` : "All alerts read"}
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
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
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
        {loading ? (
          <div className="text-center py-16 text-navy-500">Loading alerts...</div>
        ) : filtered?.length === 0 && (
          <div className="text-center py-16 text-navy-500">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No alerts found</p>
          </div>
        )}
        {filtered?.map((alert) => {
          const cfg = SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.LOW;
          const Icon = cfg.icon;
          return (
            <div
              key={alert.id}
              className={`flex items-start gap-4 p-4 rounded-container border transition-all ${cfg.bg} ${cfg.border} ${
                !alert.is_read ? "opacity-100" : "opacity-60"
              } ${alert.is_resolved ? "opacity-40" : ""}`}
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
                  {!alert.is_read && (
                    <span className="w-2 h-2 rounded-full bg-accent" />
                  )}
                  {alert.is_resolved && (
                    <span className="text-xs px-1.5 py-0.5 bg-safe/10 border border-safe/20 text-safe rounded">
                      RESOLVED
                    </span>
                  )}
                </div>
                <p className="text-navy-300 text-sm mt-1">{alert.description}</p>
                <p className="text-navy-500 text-xs mt-1">{timeAgo(alert.created_at)}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {!alert.is_read && (
                  <button
                    onClick={() => markRead(alert.id)}
                    className="p-1.5 rounded bg-navy-700 hover:bg-navy-600 text-navy-400 hover:text-navy-200 transition-colors"
                    title="Mark as read"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
                {!alert.is_resolved && (
                  <button
                    onClick={() => markResolved(alert.id)}
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
