import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import StatCard from "../components/StatCard";
import RiskBadge from "../components/RiskBadge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  ArrowLeftRight, AlertTriangle, ShieldAlert, FolderOpen,
  Play, Square, Zap,
} from "lucide-react";

interface Props {
  orgId: Id<"organisations">;
}

const RISK_COLORS = {
  LOW: "#10B981",
  MEDIUM: "#F59E0B",
  HIGH: "#F97316",
  CRITICAL: "#EF4444",
};

function formatZAR(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(amount);
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

export default function Dashboard({ orgId }: Props) {
  const stats = useQuery(api.transactions.getStats, { organisationId: orgId });
  const recentTx = useQuery(api.transactions.list, { organisationId: orgId, limit: 15 });
  const recentAlerts = useQuery(api.alerts.list, { organisationId: orgId, limit: 5 });
  const cases = useQuery(api.cases.list, { organisationId: orgId });
  const demoState = useQuery(api.demo.getState, { organisationId: orgId });
  const startDemo = useMutation(api.demo.start);
  const stopDemo = useMutation(api.demo.stop);

  const riskChartData = stats
    ? Object.entries(stats.riskDist).map(([level, count]) => ({ level, count }))
    : [];

  const openCases = cases?.filter((c) => c.status === "OPEN" || c.status === "INVESTIGATING").length ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-navy-400 text-sm mt-0.5">Real-time fraud monitoring overview</p>
        </div>
        <div className="flex items-center gap-3">
          {demoState?.isRunning && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded text-accent text-sm">
              <span className="w-2 h-2 rounded-full bg-accent live-dot" />
              Demo Live — {demoState.transactionCount} txns
            </div>
          )}
          <button
            onClick={() => demoState?.isRunning ? stopDemo({ organisationId: orgId }) : startDemo({ organisationId: orgId })}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition-colors ${
              demoState?.isRunning
                ? "bg-navy-700 hover:bg-navy-600 text-navy-200"
                : "bg-accent hover:bg-accent-hover text-white"
            }`}
          >
            {demoState?.isRunning ? (
              <><Square className="w-4 h-4" /> Stop Demo</>
            ) : (
              <><Play className="w-4 h-4" /> Start Demo</>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Transactions Today"
          value={stats?.totalToday ?? 0}
          subtitle="All channels"
          icon={ArrowLeftRight}
          color="blue"
        />
        <StatCard
          title="Flagged Transactions"
          value={stats?.flaggedTotal ?? 0}
          subtitle="HIGH + CRITICAL"
          icon={AlertTriangle}
          color="amber"
        />
        <StatCard
          title="Critical Alerts"
          value={stats?.criticalTotal ?? 0}
          subtitle="Requires immediate action"
          icon={ShieldAlert}
          color="red"
        />
        <StatCard
          title="Open Cases"
          value={openCases}
          subtitle="Under investigation"
          icon={FolderOpen}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Feed */}
        <div className="lg:col-span-2 bg-navy-900 border border-navy-800 rounded-container">
          <div className="flex items-center justify-between p-4 border-b border-navy-800">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-warning" />
              <h2 className="text-white font-semibold">Live Transaction Feed</h2>
            </div>
            {demoState?.isRunning && (
              <div className="flex items-center gap-1.5 text-xs text-safe">
                <span className="w-1.5 h-1.5 rounded-full bg-safe live-dot" />
                LIVE
              </div>
            )}
          </div>
          <div className="divide-y divide-navy-800 max-h-96 overflow-y-auto">
            {recentTx?.length === 0 && (
              <div className="p-8 text-center text-navy-500">
                <ArrowLeftRight className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No transactions yet. Start the demo to see live data.</p>
              </div>
            )}
            {recentTx?.map((tx) => (
              <div key={tx._id} className="flex items-center gap-3 px-4 py-3 hover:bg-navy-800/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium truncate">
                      {tx.merchantName ?? tx.accountHolder}
                    </span>
                    {tx.isDemo && (
                      <span className="text-xs px-1.5 py-0.5 bg-navy-700 text-navy-400 rounded">DEMO</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-navy-500 text-xs">{tx.accountNumber}</span>
                    <span className="text-navy-600 text-xs">·</span>
                    <span className="text-navy-500 text-xs">{tx.channel}</span>
                    <span className="text-navy-600 text-xs">·</span>
                    <span className="text-navy-500 text-xs">{timeAgo(tx._creationTime)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white text-sm font-semibold">{formatZAR(tx.amount)}</p>
                  <RiskBadge level={tx.riskLevel} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="space-y-4">
          <div className="bg-navy-900 border border-navy-800 rounded-container p-4">
            <h2 className="text-white font-semibold mb-4">Risk Distribution</h2>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={riskChartData} barSize={32}>
                <XAxis dataKey="level" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 8 }}
                  labelStyle={{ color: "#94A3B8" }}
                  itemStyle={{ color: "#F1F5F9" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {riskChartData.map((entry) => (
                    <Cell key={entry.level} fill={RISK_COLORS[entry.level as keyof typeof RISK_COLORS]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Alerts */}
          <div className="bg-navy-900 border border-navy-800 rounded-container p-4">
            <h2 className="text-white font-semibold mb-3">Recent Alerts</h2>
            <div className="space-y-2">
              {recentAlerts?.length === 0 && (
                <p className="text-navy-500 text-sm text-center py-4">No alerts yet</p>
              )}
              {recentAlerts?.map((alert) => (
                <div key={alert._id} className={`p-2.5 rounded border text-xs ${
                  alert.severity === "CRITICAL"
                    ? "bg-accent/5 border-accent/20"
                    : alert.severity === "HIGH"
                    ? "bg-orange-500/5 border-orange-500/20"
                    : "bg-warning/5 border-warning/20"
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-semibold ${
                      alert.severity === "CRITICAL" ? "text-accent" :
                      alert.severity === "HIGH" ? "text-orange-400" : "text-warning"
                    }`}>{alert.title}</span>
                    {!alert.isRead && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
                  </div>
                  <p className="text-navy-400 mt-0.5 truncate">{alert.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Volume stat */}
      <div className="bg-navy-900 border border-navy-800 rounded-container p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-navy-400 text-sm">Total Transaction Volume Today</p>
            <p className="text-3xl font-bold text-white mt-1">{formatZAR(stats?.totalVolume ?? 0)}</p>
          </div>
          <div className="text-right">
            <p className="text-navy-400 text-sm">Protected from fraud</p>
            <p className="text-2xl font-bold text-safe mt-1">
              {formatZAR((stats?.flaggedTotal ?? 0) * 12500)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

