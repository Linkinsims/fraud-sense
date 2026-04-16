import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import RiskBadge from "../components/RiskBadge";
import { useState } from "react";
import { Search, X, CheckCircle, XCircle, ChevronDown } from "lucide-react";

interface Props {
  orgId: Id<"organisations">;
}

function formatZAR(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(amount);
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString("en-ZA");
}

const FLAG_LABELS: Record<string, string> = {
  VELOCITY_BREACH: "Velocity",
  CARD_TESTING: "Card Test",
  AFTER_HOURS: "After Hours",
  AMOUNT_ANOMALY: "Amt Anomaly",
  FOREIGN_TRANSACTION: "Foreign",
  GEO_ANOMALY: "Geo Anomaly",
  NEW_DEVICE: "New Device",
  ACCOUNT_TAKEOVER_SIGNAL: "ATO Signal",
  MULE_ACCOUNT_PATTERN: "Mule",
  SALARY_DIVERSION_RISK: "Salary Div",
};

export default function Transactions({ orgId }: Props) {
  const transactions = useQuery(api.transactions.list, { organisationId: orgId, limit: 200 });
  const markReviewed = useMutation(api.transactions.markReviewed);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = transactions?.filter((tx) => {
    const matchSearch =
      !search ||
      tx.accountHolder.toLowerCase().includes(search.toLowerCase()) ||
      tx.accountNumber.includes(search) ||
      (tx.merchantName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchRisk = riskFilter === "ALL" || tx.riskLevel === riskFilter;
    return matchSearch && matchRisk;
  });

  const selectedTx = transactions?.find((t) => t._id === selected);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-navy-400 text-sm mt-0.5">{filtered?.length ?? 0} transactions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search account, merchant..."
            className="w-full pl-9 pr-4 py-2 bg-navy-800 border border-navy-700 rounded text-sm text-navy-200 placeholder-navy-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        {(["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((level) => (
          <button
            key={level}
            onClick={() => setRiskFilter(level)}
            className={`px-3 py-2 rounded text-xs font-semibold border transition-colors ${
              riskFilter === level
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-navy-800 border-navy-700 text-navy-400 hover:text-navy-200"
            }`}
          >
            {level}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Table */}
        <div className="flex-1 bg-navy-900 border border-navy-800 rounded-container overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-800">
                  <th className="text-left px-4 py-3 text-navy-400 font-medium">Account</th>
                  <th className="text-left px-4 py-3 text-navy-400 font-medium">Merchant</th>
                  <th className="text-left px-4 py-3 text-navy-400 font-medium">Channel</th>
                  <th className="text-right px-4 py-3 text-navy-400 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-navy-400 font-medium">Risk</th>
                  <th className="text-left px-4 py-3 text-navy-400 font-medium">Flags</th>
                  <th className="text-left px-4 py-3 text-navy-400 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800">
                {filtered?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-navy-500">
                      No transactions found
                    </td>
                  </tr>
                )}
                {filtered?.map((tx) => (
                  <tr
                    key={tx._id}
                    onClick={() => setSelected(selected === tx._id ? null : tx._id)}
                    className={`cursor-pointer transition-colors ${
                      selected === tx._id ? "bg-navy-800" : "hover:bg-navy-800/50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{tx.accountHolder}</p>
                      <p className="text-navy-500 text-xs">{tx.accountNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-navy-200">{tx.merchantName ?? "—"}</p>
                      <p className="text-navy-500 text-xs">{tx.merchantCity ?? tx.merchantCountry}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-navy-700 text-navy-300 text-xs rounded">
                        {tx.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-white font-semibold">{formatZAR(tx.amount)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge level={tx.riskLevel} score={Math.round(tx.riskScore)} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {tx.fraudFlags.slice(0, 2).map((f) => (
                          <span key={f} className="px-1.5 py-0.5 bg-accent/10 text-accent text-xs rounded border border-accent/20">
                            {FLAG_LABELS[f] ?? f}
                          </span>
                        ))}
                        {tx.fraudFlags.length > 2 && (
                          <span className="text-navy-500 text-xs">+{tx.fraudFlags.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-navy-400 text-xs whitespace-nowrap">
                      {timeAgo(tx._creationTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Panel */}
        {selectedTx && (
          <div className="w-80 bg-navy-900 border border-navy-800 rounded-container p-4 shrink-0 slide-in-right">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Transaction Detail</h3>
              <button onClick={() => setSelected(null)} className="text-navy-500 hover:text-navy-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-navy-500 text-xs">Amount</p>
                <p className="text-white text-xl font-bold">{formatZAR(selectedTx.amount)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-navy-500 text-xs">Risk Score</p>
                  <RiskBadge level={selectedTx.riskLevel} score={Math.round(selectedTx.riskScore)} />
                </div>
                <div>
                  <p className="text-navy-500 text-xs">Channel</p>
                  <p className="text-navy-200">{selectedTx.channel}</p>
                </div>
              </div>
              <div>
                <p className="text-navy-500 text-xs">Account Holder</p>
                <p className="text-navy-200">{selectedTx.accountHolder}</p>
                <p className="text-navy-500 text-xs">{selectedTx.accountNumber}</p>
              </div>
              <div>
                <p className="text-navy-500 text-xs">Merchant</p>
                <p className="text-navy-200">{selectedTx.merchantName ?? "—"}</p>
                <p className="text-navy-500 text-xs">{selectedTx.merchantCity}, {selectedTx.merchantCountry}</p>
              </div>
              <div>
                <p className="text-navy-500 text-xs">Bank</p>
                <p className="text-navy-200">{selectedTx.bankCode}</p>
              </div>
              {selectedTx.deviceId && (
                <div>
                  <p className="text-navy-500 text-xs">Device ID</p>
                  <p className="text-navy-200 font-mono text-xs">{selectedTx.deviceId}</p>
                </div>
              )}
              {selectedTx.fraudFlags.length > 0 && (
                <div>
                  <p className="text-navy-500 text-xs mb-1">Fraud Flags</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedTx.fraudFlags.map((f) => (
                      <span key={f} className="px-2 py-0.5 bg-accent/10 text-accent text-xs rounded border border-accent/20">
                        {FLAG_LABELS[f] ?? f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {!selectedTx.isReviewed && (
                <div className="flex gap-2 pt-2 border-t border-navy-800">
                  <button
                    onClick={() => markReviewed({ transactionId: selectedTx._id, isFraud: false })}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-safe/10 border border-safe/20 text-safe text-xs rounded hover:bg-safe/20 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Legitimate
                  </button>
                  <button
                    onClick={() => markReviewed({ transactionId: selectedTx._id, isFraud: true })}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-accent/10 border border-accent/20 text-accent text-xs rounded hover:bg-accent/20 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Fraud
                  </button>
                </div>
              )}
              {selectedTx.isReviewed && (
                <div className={`text-center py-2 rounded text-xs font-semibold ${
                  selectedTx.isFraud ? "bg-accent/10 text-accent" : "bg-safe/10 text-safe"
                }`}>
                  {selectedTx.isFraud ? "✗ Confirmed Fraud" : "✓ Confirmed Legitimate"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

