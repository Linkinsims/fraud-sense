import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";
import { FolderOpen, Plus, X } from "lucide-react";

interface Props {
  orgId: string;
}

function formatZAR(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(amount);
}

function timeAgo(dateString: string) {
  const ts = new Date(dateString).getTime();
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString("en-ZA");
}

const STATUS_CONFIG = {
  OPEN: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400" },
  INVESTIGATING: { bg: "bg-warning/10", border: "border-warning/20", text: "text-warning" },
  ESCALATED: { bg: "bg-accent/10", border: "border-accent/20", text: "text-accent" },
  RESOLVED: { bg: "bg-safe/10", border: "border-safe/20", text: "text-safe" },
  CLOSED: { bg: "bg-navy-700/50", border: "border-navy-600", text: "text-navy-400" },
};

const PRIORITY_CONFIG = {
  LOW: "text-safe",
  MEDIUM: "text-warning",
  HIGH: "text-orange-400",
  CRITICAL: "text-accent",
};

const STATUS_OPTIONS = ["OPEN", "INVESTIGATING", "ESCALATED", "RESOLVED", "CLOSED"] as const;

export default function Cases({ orgId }: Props) {
  const [cases, setCases] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("HIGH");
  const [newNotes, setNewNotes] = useState("");
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [noteText, setNoteText] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    async function fetchData() {
      const { data: casesData } = await supabase
        .from('cases')
        .select('*')
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false });
      
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('organisation_id', orgId)
        .limit(200);

      setCases(casesData || []);
      setTransactions(txData || []);
      setLoading(false);
    }

    fetchData();

    const subscription = supabase
      .channel('cases_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cases', filter: `organisation_id=eq.${orgId}` }, 
        (payload) => {
          if (payload.eventType === 'INSERT') setCases(prev => [payload.new, ...prev]);
          else if (payload.eventType === 'UPDATE') setCases(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
        }
      ).subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [orgId]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    
    const caseNumber = `CASE-${Math.floor(Math.random() * 1000000)}`;
    const totalAmount = transactions
      .filter(tx => selectedTxIds.includes(tx.id))
      .reduce((sum, tx) => sum + tx.amount, 0);

    const { data: newCase, error } = await supabase
      .from('cases')
      .insert({
        organisation_id: orgId,
        title: newTitle,
        priority: newPriority,
        notes: newNotes,
        case_number: caseNumber,
        status: 'OPEN',
        total_amount: totalAmount
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating case:", error);
      return;
    }

    // Link transactions to case
    if (selectedTxIds.length > 0) {
      await supabase
        .from('transactions')
        .update({ case_id: newCase.id })
        .in('id', selectedTxIds);
    }

    setShowCreate(false);
    setNewTitle("");
    setNewNotes("");
    setSelectedTxIds([]);
  };

  const updateStatus = async (caseId: string, status: string) => {
    const { error } = await supabase.from('cases').update({ status }).eq('id', caseId);
    if (error) console.error("Error updating status:", error);
  };

  const saveNotes = async (caseId: string, notes: string) => {
    const { error } = await supabase.from('cases').update({ notes }).eq('id', caseId);
    if (error) console.error("Error saving notes:", error);
  };

  const selectedCase = cases?.find((c) => c.id === selected);
  const highRiskTx = transactions?.filter((t) => (t.risk_level === "HIGH" || t.risk_level === "CRITICAL") && !t.case_id) ?? [];
  const filtered = cases?.filter((c) => statusFilter === "ALL" || c.status === statusFilter);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cases</h1>
          <p className="text-navy-400 text-sm mt-0.5">{loading ? "Loading..." : `${cases?.length ?? 0} total cases`}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded transition-colors"
        >
          <Plus className="w-4 h-4" /> New Case
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["ALL", ...STATUS_OPTIONS] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
              statusFilter === s
                ? "bg-navy-700 border-navy-600 text-white"
                : "bg-navy-800 border-navy-700 text-navy-400 hover:text-navy-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          {loading ? (
            <div className="text-center py-16 text-navy-500">Loading cases...</div>
          ) : filtered?.length === 0 && (
            <div className="text-center py-16 text-navy-500">
              <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No cases found. Create one from flagged transactions.</p>
            </div>
          )}
          {filtered?.map((c) => {
            const sc = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.OPEN;
            return (
              <div
                key={c.id}
                onClick={() => setSelected(selected === c.id ? null : c.id)}
                className={`p-4 rounded-container border cursor-pointer transition-all ${
                  selected === c.id
                    ? "bg-navy-800 border-navy-600"
                    : "bg-navy-900 border-navy-800 hover:border-navy-700"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-navy-500 text-xs font-mono">{c.case_number}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${sc.bg} ${sc.border} ${sc.text}`}>
                        {c.status}
                      </span>
                      <span className={`text-xs font-semibold ${PRIORITY_CONFIG[c.priority as keyof typeof PRIORITY_CONFIG]}`}>
                        {c.priority}
                      </span>
                    </div>
                    <p className="text-white font-medium mt-1">{c.title}</p>
                    {c.notes && <p className="text-navy-400 text-xs mt-1 truncate">{c.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white font-semibold text-sm">{formatZAR(c.total_amount)}</p>
                    <p className="text-navy-500 text-xs">{timeAgo(c.created_at)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {selectedCase && (
          <div className="w-80 bg-navy-900 border border-navy-800 rounded-container p-4 shrink-0 slide-in-right space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">Case Detail</h3>
              <button onClick={() => setSelected(null)} className="text-navy-500 hover:text-navy-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-navy-500 text-xs">Case Number</p>
                <p className="text-white font-mono">{selectedCase.case_number}</p>
              </div>
              <div>
                <p className="text-navy-500 text-xs">Title</p>
                <p className="text-navy-200">{selectedCase.title}</p>
              </div>
              <div>
                <p className="text-navy-500 text-xs">Total Amount</p>
                <p className="text-white font-bold text-lg">{formatZAR(selectedCase.total_amount)}</p>
              </div>
              <div>
                <p className="text-navy-500 text-xs mb-1">Update Status</p>
                <div className="grid grid-cols-2 gap-1">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(selectedCase.id, s)}
                      className={`py-1.5 text-xs rounded border transition-colors ${
                        selectedCase.status === s
                          ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].border} ${STATUS_CONFIG[s].text}`
                          : "bg-navy-800 border-navy-700 text-navy-400 hover:text-navy-200"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-navy-500 text-xs mb-1">Notes</p>
                <textarea
                  value={noteText || selectedCase.notes || ""}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-xs text-navy-200 placeholder-navy-500 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Add investigation notes..."
                />
                <button
                  onClick={() => {
                    saveNotes(selectedCase.id, noteText || selectedCase.notes || "");
                    setNoteText("");
                  }}
                  className="mt-1 w-full py-1.5 bg-navy-700 hover:bg-navy-600 text-navy-200 text-xs rounded transition-colors"
                >
                  Save Notes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-navy-900 border border-navy-700 rounded-container p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">New Case</h2>
              <button onClick={() => setShowCreate(false)} className="text-navy-500 hover:text-navy-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-navy-400 text-xs mb-1 block">Case Title</label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-sm text-navy-200 placeholder-navy-500 focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Suspected card testing ring"
                />
              </div>
              <div>
                <label className="text-navy-400 text-xs mb-1 block">Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as any)}
                  className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-sm text-navy-200 focus:outline-none focus:border-blue-500"
                >
                  {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-navy-400 text-xs mb-1 block">
                  Link Flagged Transactions ({highRiskTx.length} available)
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1 bg-navy-800 border border-navy-700 rounded p-2">
                  {highRiskTx.length === 0 && (
                    <p className="text-navy-500 text-xs text-center py-2">No unlinked high-risk transactions</p>
                  )}
                  {highRiskTx.map((tx) => (
                    <label key={tx.id} className="flex items-center gap-2 cursor-pointer hover:bg-navy-700 px-2 py-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedTxIds.includes(tx.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTxIds([...selectedTxIds, tx.id]);
                          else setSelectedTxIds(selectedTxIds.filter(id => id !== tx.id));
                        }}
                      />
                      <span className="text-white text-xs font-medium">{formatZAR(tx.amount)}</span>
                      <span className="text-navy-400 text-[10px]">{tx.account_holder}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim()}
                className="w-full py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded transition-colors"
              >
                Create Case
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
