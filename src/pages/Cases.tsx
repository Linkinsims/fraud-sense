import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { FolderOpen, Plus, X } from "lucide-react";

interface Props {
  orgId: Id<"organisations">;
}

function formatZAR(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(amount);
}

function timeAgo(ts: number) {
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
  const cases = useQuery(api.cases.list, { organisationId: orgId });
  const transactions = useQuery(api.transactions.list, { organisationId: orgId, limit: 200 });
  const createCase = useMutation(api.cases.create);
  const updateStatus = useMutation(api.cases.updateStatus);
  const addNote = useMutation(api.cases.addNote);

  const [selected, setSelected] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("HIGH");
  const [newNotes, setNewNotes] = useState("");
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [noteText, setNoteText] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const selectedCase = cases?.find((c) => c._id === selected);
  const highRiskTx = transactions?.filter((t) => (t.riskLevel === "HIGH" || t.riskLevel === "CRITICAL") && !t.caseId) ?? [];

  const filtered = cases?.filter((c) => statusFilter === "ALL" || c.status === statusFilter);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    await createCase({
      organisationId: orgId,
      title: newTitle,
      priority: newPriority,
      transactionIds: selectedTxIds as Id<"transactions">[],
      notes: newNotes || undefined,
    });
    setShowCreate(false);
    setNewTitle("");
    setNewNotes("");
    setSelectedTxIds([]);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cases</h1>
          <p className="text-navy-400 text-sm mt-0.5">{cases?.length ?? 0} total cases</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded transition-colors"
        >
          <Plus className="w-4 h-4" /> New Case
        </button>
      </div>

      {/* Status filters */}
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
        {/* Cases list */}
        <div className="flex-1 space-y-2">
          {filtered?.length === 0 && (
            <div className="text-center py-16 text-navy-500">
              <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No cases found. Create one from flagged transactions.</p>
            </div>
          )}
          {filtered?.map((c) => {
            const sc = STATUS_CONFIG[c.status];
            return (
              <div
                key={c._id}
                onClick={() => setSelected(selected === c._id ? null : c._id)}
                className={`p-4 rounded-container border cursor-pointer transition-all ${
                  selected === c._id
                    ? "bg-navy-800 border-navy-600"
                    : "bg-navy-900 border-navy-800 hover:border-navy-700"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-navy-500 text-xs font-mono">{c.caseNumber}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${sc.bg} ${sc.border} ${sc.text}`}>
                        {c.status}
                      </span>
                      <span className={`text-xs font-semibold ${PRIORITY_CONFIG[c.priority]}`}>
                        {c.priority}
                      </span>
                    </div>
                    <p className="text-white font-medium mt-1">{c.title}</p>
                    {c.notes && <p className="text-navy-400 text-xs mt-1 truncate">{c.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white font-semibold text-sm">{formatZAR(c.totalAmount)}</p>
                    <p className="text-navy-500 text-xs">{timeAgo(c._creationTime)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
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
                <p className="text-white font-mono">{selectedCase.caseNumber}</p>
              </div>
              <div>
                <p className="text-navy-500 text-xs">Title</p>
                <p className="text-navy-200">{selectedCase.title}</p>
              </div>
              <div>
                <p className="text-navy-500 text-xs">Total Amount</p>
                <p className="text-white font-bold text-lg">{formatZAR(selectedCase.totalAmount)}</p>
              </div>
              <div>
                <p className="text-navy-500 text-xs mb-1">Update Status</p>
                <div className="grid grid-cols-2 gap-1">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus({ caseId: selectedCase._id, status: s })}
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
                    addNote({ caseId: selectedCase._id, notes: noteText || selectedCase.notes || "" });
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

      {/* Create Case Modal */}
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
                    <label key={tx._id} className="flex items-center gap-2 cursor-pointer hover:bg-navy-700 px-2 py-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedTxIds.includes(tx._id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTxIds([...selectedTxIds, tx._id]);
                          else setSelectedTxIds(selectedTxIds.filter((id) => id !== tx._id));
                        }}
                        className="accent-accent"
                      />
                      <span className="text-xs text-navy-300 flex-1 truncate">
                        {tx.accountHolder} — {formatZAR(tx.amount)}
                      </span>
                      <span className={`text-xs font-semibold ${PRIORITY_CONFIG[tx.riskLevel]}`}>{tx.riskLevel}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-navy-400 text-xs mb-1 block">Notes (optional)</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-sm text-navy-200 placeholder-navy-500 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Initial investigation notes..."
                />
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
                disabled={!newTitle.trim()}
                className="flex-1 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded transition-colors disabled:opacity-50"
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
