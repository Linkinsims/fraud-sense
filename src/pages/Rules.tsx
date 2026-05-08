import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";
import { Settings2, Plus, Trash2, ToggleLeft, ToggleRight, X } from "lucide-react";

interface Props {
  orgId: string;
}

const ACTION_CONFIG = {
  ALERT: { bg: "bg-warning/10", border: "border-warning/20", text: "text-warning" },
  BLOCK: { bg: "bg-accent/10", border: "border-accent/20", text: "text-accent" },
  FLAG: { bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-400" },
  REVIEW: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400" },
};

const SEVERITY_TEXT = {
  LOW: "text-safe",
  MEDIUM: "text-warning",
  HIGH: "text-orange-400",
  CRITICAL: "text-accent",
};

const FIELD_OPTIONS = [
  { value: "amount", label: "Transaction Amount (ZAR)" },
  { value: "riskScore", label: "Risk Score (0–100)" },
];

const OPERATOR_OPTIONS = [
  { value: "gt", label: "Greater than (>)" },
  { value: "lt", label: "Less than (<)" },
  { value: "gte", label: "Greater than or equal (≥)" },
  { value: "lte", label: "Less than or equal (≤)" },
];

export default function Rules({ orgId }: Props) {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    field: "amount",
    operator: "gt",
    value: 50000,
    action: "ALERT" as "ALERT" | "BLOCK" | "FLAG" | "REVIEW",
    severity: "HIGH" as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    score_boost: 20,
  });

  useEffect(() => {
    async function fetchRules() {
      const { data, error } = await supabase
        .from('rules')
        .select('*')
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false });

      if (error) console.error("Error fetching rules:", error);
      else setRules(data || []);
      setLoading(false);
    }

    fetchRules();

    const subscription = supabase
      .channel('rules_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rules', filter: `organisation_id=eq.${orgId}` }, 
        (payload) => {
          if (payload.eventType === 'INSERT') setRules(prev => [payload.new, ...prev]);
          else if (payload.eventType === 'UPDATE') setRules(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
          else if (payload.eventType === 'DELETE') setRules(prev => prev.filter(r => r.id !== payload.old.id));
        }
      ).subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [orgId]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    const { error } = await supabase.from('rules').insert({ organisation_id: orgId, ...form, is_active: true });
    if (error) console.error("Error creating rule:", error);
    else {
      setShowCreate(false);
      setForm({ name: "", description: "", field: "amount", operator: "gt", value: 50000, action: "ALERT", severity: "HIGH", score_boost: 20 });
    }
  };

  const toggleRule = async (ruleId: string, isActive: boolean) => {
    const { error } = await supabase.from('rules').update({ is_active: isActive }).eq('id', ruleId);
    if (error) console.error("Error toggling rule:", error);
  };

  const removeRule = async (ruleId: string) => {
    const { error } = await supabase.from('rules').delete().eq('id', ruleId);
    if (error) console.error("Error removing rule:", error);
  };

  const activeCount = rules?.filter((r) => r.is_active).length ?? 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Detection Rules</h1>
          <p className="text-navy-400 text-sm mt-0.5">{loading ? "Loading..." : `${activeCount} active / ${rules?.length ?? 0} total rules`}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded transition-colors"
        >
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      {/* Rules list */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-16 text-navy-500">Loading rules...</div>
        ) : rules?.length === 0 && (
          <div className="text-center py-16 text-navy-500">
            <Settings2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No rules configured yet.</p>
          </div>
        )}
        {rules?.map((rule) => {
          const ac = ACTION_CONFIG[rule.action as keyof typeof ACTION_CONFIG] || ACTION_CONFIG.ALERT;
          return (
            <div
              key={rule.id}
              className={`flex items-center gap-4 p-4 rounded-container border transition-all bg-navy-900 ${
                rule.is_active ? "border-navy-800" : "border-navy-800 opacity-50"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-medium">{rule.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${ac.bg} ${ac.border} ${ac.text}`}>
                    {rule.action}
                  </span>
                  <span className={`text-xs font-semibold ${SEVERITY_TEXT[rule.severity as keyof typeof SEVERITY_TEXT]}`}>
                    {rule.severity}
                  </span>
                  {!rule.is_active && (
                    <span className="text-xs px-1.5 py-0.5 bg-navy-700 text-navy-500 rounded border border-navy-600">
                      DISABLED
                    </span>
                  )}
                </div>
                <p className="text-navy-400 text-xs mt-1">{rule.description}</p>
                <p className="text-navy-500 text-xs mt-0.5 font-mono">
                  {rule.field} {rule.operator} {rule.value.toLocaleString()} → +{rule.score_boost} risk score
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleRule(rule.id, !rule.is_active)}
                  className="text-navy-400 hover:text-navy-200 transition-colors"
                  title={rule.is_active ? "Disable rule" : "Enable rule"}
                >
                  {rule.is_active
                    ? <ToggleRight className="w-6 h-6 text-safe" />
                    : <ToggleLeft className="w-6 h-6" />
                  }
                </button>
                <button
                  onClick={() => removeRule(rule.id)}
                  className="p-1.5 rounded hover:bg-accent/10 text-navy-500 hover:text-accent transition-colors"
                  title="Delete rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Rule Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-navy-900 border border-navy-700 rounded-container p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">New Detection Rule</h2>
              <button onClick={() => setShowCreate(false)} className="text-navy-500 hover:text-navy-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: "Rule Name", key: "name", type: "text", placeholder: "e.g. High Amount Alert" },
                { label: "Description", key: "description", type: "text", placeholder: "What does this rule detect?" },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="text-navy-400 text-xs mb-1 block">{label}</label>
                  <input
                    type={type}
                    value={(form as any)[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-sm text-navy-200 placeholder-navy-500 focus:outline-none focus:border-blue-500"
                    placeholder={placeholder}
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-navy-400 text-xs mb-1 block">Field</label>
                  <select
                    value={form.field}
                    onChange={(e) => setForm({ ...form, field: e.target.value })}
                    className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-sm text-navy-200 focus:outline-none focus:border-blue-500"
                  >
                    {FIELD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-navy-400 text-xs mb-1 block">Operator</label>
                  <select
                    value={form.operator}
                    onChange={(e) => setForm({ ...form, operator: e.target.value })}
                    className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-sm text-navy-200 focus:outline-none focus:border-blue-500"
                  >
                    {OPERATOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-navy-400 text-xs mb-1 block">Threshold Value</label>
                  <input
                    type="number"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-sm text-navy-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-navy-400 text-xs mb-1 block">Score Boost</label>
                  <input
                    type="number"
                    value={form.score_boost}
                    onChange={(e) => setForm({ ...form, score_boost: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-sm text-navy-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-navy-400 text-xs mb-1 block">Action</label>
                  <select
                    value={form.action}
                    onChange={(e) => setForm({ ...form, action: e.target.value as any })}
                    className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-sm text-navy-200 focus:outline-none focus:border-blue-500"
                  >
                    {(["ALERT", "BLOCK", "FLAG", "REVIEW"] as const).map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-navy-400 text-xs mb-1 block">Severity</label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value as any })}
                    className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-sm text-navy-200 focus:outline-none focus:border-blue-500"
                  >
                    {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 bg-navy-800 border border-navy-700 text-navy-300 text-sm rounded hover:bg-navy-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.name.trim()}
                className="flex-1 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded transition-colors disabled:opacity-50"
              >
                Create Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
