import { supabase } from "../lib/supabase";
import StatCard from "../components/StatCard";
import RiskBadge from "../components/RiskBadge";
import { useEffect, useState, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  ArrowLeftRight, AlertTriangle, ShieldAlert, FolderOpen, Zap, Play, Square,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  orgId: string;
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

function timeAgo(dateString: string) {
  const ts = new Date(dateString).getTime();
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

const SCENARIOS = [
  { holder: "Sipho Dlamini", bank: "ABSA", amount: 15000, risk: "LOW", score: 12, flags: [] },
  { holder: "Sarah van Wyk", bank: "FNB", amount: 850, risk: "LOW", score: 5, flags: [] },
  { holder: "Unknown", bank: "Standard Bank", amount: 45000, risk: "HIGH", score: 82, flags: ["VELOCITY_BREACH", "GEO_ANOMALY"], merchant: "International Store" },
  { holder: "John Doe", bank: "Capitec", amount: 120, risk: "LOW", score: 2, flags: [] },
  { holder: "Mary Smith", bank: "Nedbank", amount: 125000, risk: "CRITICAL", score: 98, flags: ["AMOUNT_ANOMALY", "NEW_DEVICE", "FOREIGN_TRANSACTION"], merchant: "Luxury Watches" },
  { holder: "Thabo Mbeki", bank: "Discovery", amount: 3200, risk: "MEDIUM", score: 45, flags: ["AFTER_HOURS"] },
];

export default function Dashboard({ orgId }: Props) {
  const [stats, setStats] = useState<any>(null);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [casesCount, setCasesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const demoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statsRef = useRef<any>(null);

  const fetchDashboardData = async () => {
    const { data: orgData } = await supabase.from('organisations').select('*').eq('id', orgId).single();
    setStats(orgData);
    statsRef.current = orgData;

    const { data: txData } = await supabase.from('transactions').select('*').eq('organisation_id', orgId).order('created_at', { ascending: false }).limit(15);
    setRecentTx(txData || []);

    const { data: alertsData } = await supabase.from('alerts').select('*').eq('organisation_id', orgId).order('created_at', { ascending: false }).limit(5);
    setRecentAlerts(alertsData || []);

    const { count } = await supabase.from('cases').select('*', { count: 'exact', head: true }).eq('organisation_id', orgId).in('status', ['OPEN', 'INVESTIGATING']);
    setCasesCount(count || 0);
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();

    const txSubscription = supabase
      .channel('dashboard_tx')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `organisation_id=eq.${orgId}` }, 
        (payload) => {
          setRecentTx(prev => [payload.new, ...prev].slice(0, 15));
          // Throttle stats updates to avoid overwhelming the UI
          if (Math.random() > 0.8) fetchDashboardData();
        }
      ).subscribe();

    return () => {
      txSubscription.unsubscribe();
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    };
  }, [orgId]);

  const toggleDemo = () => {
    if (isDemoRunning) {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
      setIsDemoRunning(false);
      toast.info("Turbo demo stopped");
    } else {
      setIsDemoRunning(true);
      toast.success("TURBO MODE: 10 txns/sec active");
      
      // 100ms interval = 10 transactions per second
      demoIntervalRef.current = setInterval(async () => {
        const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
        const newTx = {
          organisation_id: orgId,
          account_holder: scenario.holder,
          bank_code: scenario.bank,
          amount: scenario.amount + (Math.random() * 500),
          currency: "ZAR",
          type: "PAYMENT",
          channel: "ONLINE",
          merchant_name: scenario.merchant || "Local Merchant",
          merchant_country: "ZA",
          risk_level: scenario.risk,
          risk_score: scenario.score,
          fraud_flags: scenario.flags,
          is_demo: true,
        };

        // Fire and forget to maximize throughput
        supabase.from('transactions').insert(newTx).then(({ data: tx }) => {
          if (tx && scenario.risk === "CRITICAL") {
            supabase.from('alerts').insert({
              organisation_id: orgId,
              transaction_id: tx.id,
              type: "FRAUD_ATTEMPT",
              severity: "CRITICAL",
              title: "TURBO: High Risk Detected",
              description: `Critical attempt by ${scenario.holder} for ${formatZAR(newTx.amount)}`,
            });
          }
        });

        // Batch update stats locally to keep UI snappy
        if (statsRef.current) {
          const current = statsRef.current;
          const updated = {
            ...current,
            stats_today_total: (current.stats_today_total || 0) + 1,
            stats_today_volume: (current.stats_today_volume || 0) + newTx.amount,
            stats_flagged: (current.stats_flagged || 0) + (scenario.risk === "HIGH" || scenario.risk === "CRITICAL" ? 1 : 0),
            stats_critical_count: (current.stats_critical_count || 0) + (scenario.risk === "CRITICAL" ? 1 : 0),
            stats_low: (current.stats_low || 0) + (scenario.risk === "LOW" ? 1 : 0),
            stats_medium: (current.stats_medium || 0) + (scenario.risk === "MEDIUM" ? 1 : 0),
            stats_high: (current.stats_high || 0) + (scenario.risk === "HIGH" ? 1 : 0),
          };
          statsRef.current = updated;
          setStats(updated);
          
          // Sync to DB occasionally (every 20 txns) to avoid rate limits
          if (updated.stats_today_total % 20 === 0) {
            supabase.from('organisations').update(updated).eq('id', orgId);
          }
        }
      }, 100);
    }
  };

  const riskChartData = stats ? [
    { level: 'LOW', count: stats.stats_low || 0 },
    { level: 'MEDIUM', count: stats.stats_medium || 0 },
    { level: 'HIGH', count: stats.stats_high || 0 },
    { level: 'CRITICAL', count: stats.stats_critical_count || 0 },
  ] : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-navy-400 text-sm mt-0.5">Real-time fraud monitoring overview</p>
        </div>
        <button
          onClick={toggleDemo}
          className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition-all shadow-lg ${
            isDemoRunning 
              ? "bg-accent border border-accent text-white hover:bg-accent-hover animate-pulse" 
              : "bg-safe/10 border border-safe/20 text-safe hover:bg-safe/20"
          }`}
        >
          {isDemoRunning ? <><Zap className="w-4 h-4 fill-white" /> TURBO ACTIVE</> : <><Play className="w-4 h-4" /> Start Turbo Demo</>}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Transactions Today" value={stats?.stats_today_total ?? 0} subtitle="All channels" icon={ArrowLeftRight} color="blue" />
        <StatCard title="Flagged Transactions" value={stats?.stats_flagged ?? 0} subtitle="HIGH + CRITICAL" icon={AlertTriangle} color="amber" />
        <StatCard title="Critical Alerts" value={stats?.stats_critical_count ?? 0} subtitle="Requires immediate action" icon={ShieldAlert} color="red" />
        <StatCard title="Open Cases" value={casesCount} subtitle="Under investigation" icon={FolderOpen} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-navy-900 border border-navy-800 rounded-container">
          <div className="flex items-center justify-between p-4 border-b border-navy-800">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-warning" />
              <h2 className="text-white font-semibold">Live Transaction Feed</h2>
            </div>
          </div>
          <div className="divide-y divide-navy-800 max-h-96 overflow-y-auto">
            {loading ? <div className="p-8 text-center text-navy-500">Loading live feed...</div> : recentTx?.length === 0 && <div className="p-8 text-center text-navy-500"><ArrowLeftRight className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>No transactions yet.</p></div>}
            {recentTx?.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-navy-800/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="text-white text-sm font-medium truncate">{tx.merchant_name ?? tx.account_holder}</span></div>
                  <div className="flex items-center gap-2 mt-0.5"><span className="text-navy-500 text-xs">{tx.account_number}</span><span className="text-navy-600 text-xs">·</span><span className="text-navy-500 text-xs">{tx.channel}</span><span className="text-navy-600 text-xs">·</span><span className="text-navy-500 text-xs">{timeAgo(tx.created_at)}</span></div>
                </div>
                <div className="text-right shrink-0"><p className="text-white text-sm font-semibold">{formatZAR(tx.amount)}</p><RiskBadge level={tx.risk_level} size="sm" /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-navy-900 border border-navy-800 rounded-container p-4">
            <h2 className="text-white font-semibold mb-4">Risk Distribution</h2>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={riskChartData} barSize={32}>
                <XAxis dataKey="level" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 8 }} labelStyle={{ color: "#94A3B8" }} itemStyle={{ color: "#F1F5F9" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {riskChartData.map((entry) => <Cell key={entry.level} fill={RISK_COLORS[entry.level as keyof typeof RISK_COLORS]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-navy-900 border border-navy-800 rounded-container p-4">
            <h2 className="text-white font-semibold mb-3">Recent Alerts</h2>
            <div className="space-y-2">
              {loading ? <p className="text-navy-500 text-sm text-center py-4">Loading alerts...</p> : recentAlerts?.length === 0 && <p className="text-navy-500 text-sm text-center py-4">No alerts yet</p>}
              {recentAlerts?.map((alert) => (
                <div key={alert.id} className={`p-2.5 rounded border text-xs ${alert.severity === "CRITICAL" ? "bg-accent/5 border-accent/20" : alert.severity === "HIGH" ? "bg-orange-500/5 border-orange-500/20" : "bg-warning/5 border-warning/20"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-semibold ${alert.severity === "CRITICAL" ? "text-accent" : alert.severity === "HIGH" ? "text-orange-400" : "text-warning"}`}>{alert.title}</span>
                    {!alert.is_read && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
                  </div>
                  <p className="text-navy-400 mt-0.5 truncate">{alert.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-navy-900 border border-navy-800 rounded-container p-4">
        <div className="flex items-center justify-between">
          <div><p className="text-navy-400 text-sm">Total Transaction Volume Today</p><p className="text-3xl font-bold text-white mt-1">{formatZAR(stats?.stats_today_volume ?? 0)}</p></div>
          <div className="text-right"><p className="text-navy-400 text-sm">Protected from fraud</p><p className="text-2xl font-bold text-safe mt-1">{formatZAR((stats?.stats_flagged ?? 0) * 12500)}</p></div>
        </div>
      </div>
    </div>
  );
}
