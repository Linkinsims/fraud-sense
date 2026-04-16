import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { Key, Plus, Copy, EyeOff, Eye, ShieldOff, X, Terminal, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface Props {
  orgId: Id<"organisations">;
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString("en-ZA");
}

const EXAMPLE_PAYLOAD = `{
  "amount": 15000.00,
  "type": "DEBIT",
  "channel": "ONLINE",
  "accountNumber": "4001234567",
  "accountHolder": "Sipho Dlamini",
  "bankCode": "ABSA",
  "merchantName": "Takealot",
  "merchantCity": "Cape Town",
  "merchantCountry": "ZA",
  "ipAddress": "196.25.1.100",
  "deviceId": "DEV-ABC12345",
  "latitude": -33.9249,
  "longitude": 18.4241,
  "externalId": "your-internal-tx-id-001"
}`;

const EXAMPLE_BATCH_PAYLOAD = `{
  "transactions": [
    {
      "amount": 1500.00, "type": "DEBIT", "channel": "POS",
      "accountNumber": "4001234567", "accountHolder": "Sipho Dlamini",
      "bankCode": "ABSA", "merchantCountry": "ZA"
    },
    {
      "amount": 85000.00, "type": "TRANSFER", "channel": "EFT",
      "accountNumber": "4009876543", "accountHolder": "Nomsa Khumalo",
      "bankCode": "FNB", "merchantCountry": "NG", "externalId": "tx-002"
    }
  ]
}`;

export default function ApiKeys({ orgId }: Props) {
  const keys = useQuery(api.apiKeys.list, { organisationId: orgId });
  const createKey = useMutation(api.apiKeys.create);
  const revokeKey = useMutation(api.apiKeys.revoke);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [showDocs, setShowDocs] = useState(true);

  // Derive the base URL from the current Convex deployment URL
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
  const baseUrl = convexUrl
    ? convexUrl.replace(".cloud", ".site")
    : "https://your-deployment.convex.site";

  async function handleCreate() {
    if (!newName.trim()) return;
    await createKey({ organisationId: orgId, name: newName });
    setNewName("");
    setShowCreate(false);
    toast.success("API key created successfully");
  }

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    toast.success("API key copied to clipboard");
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  const active = keys?.filter((k) => k.active).length ?? 0;
  const firstActiveKey = keys?.find((k) => k.active);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">API Keys</h1>
          <p className="text-navy-400 text-sm mt-0.5">{active} active key{active !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded transition-colors"
        >
          <Plus className="w-4 h-4" /> Generate Key
        </button>
      </div>

      {/* Keys list */}
      <div className="space-y-3">
        {keys?.length === 0 && (
          <div className="text-center py-8 text-navy-500">
            <Key className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No API keys yet. Generate one to start ingesting transactions.</p>
          </div>
        )}
        {keys?.map((k) => (
          <div
            key={k._id}
            className={`bg-navy-900 border rounded-container p-4 transition-all ${
              k.active ? "border-navy-800" : "border-navy-800 opacity-50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-navy-400 shrink-0" />
                  <span className="text-white font-medium">{k.name}</span>
                  {k.active ? (
                    <span className="text-xs px-1.5 py-0.5 bg-safe/10 border border-safe/20 text-safe rounded">ACTIVE</span>
                  ) : (
                    <span className="text-xs px-1.5 py-0.5 bg-navy-700 border border-navy-600 text-navy-400 rounded">REVOKED</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-xs font-mono text-navy-300 bg-navy-800 px-2 py-1 rounded flex-1 truncate">
                    {revealed.has(k._id) ? k.key : k.key.slice(0, 12) + "••••••••••••••••••••"}
                  </code>
                  <button
                    onClick={() => toggleReveal(k._id)}
                    className="p-1.5 rounded bg-navy-800 hover:bg-navy-700 text-navy-400 hover:text-navy-200 transition-colors shrink-0"
                    title={revealed.has(k._id) ? "Hide key" : "Reveal key"}
                  >
                    {revealed.has(k._id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  {k.active && (
                    <button
                      onClick={() => copyKey(k.key)}
                      className="p-1.5 rounded bg-navy-800 hover:bg-navy-700 text-navy-400 hover:text-navy-200 transition-colors shrink-0"
                      title="Copy key"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-navy-500 text-xs mt-1">
                  Created {timeAgo(k._creationTime)}
                  {k.lastUsed ? ` · Last used ${timeAgo(k.lastUsed)}` : " · Never used"}
                </p>
              </div>
              {k.active && (
                <button
                  onClick={() => {
                    revokeKey({ keyId: k._id });
                    toast.success("API key revoked");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 border border-accent/20 text-accent text-xs rounded hover:bg-accent/20 transition-colors shrink-0"
                >
                  <ShieldOff className="w-3.5 h-3.5" /> Revoke
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Integration Docs */}
      <div className="bg-navy-900 border border-navy-800 rounded-container overflow-hidden">
        <button
          onClick={() => setShowDocs(!showDocs)}
          className="w-full flex items-center justify-between p-4 hover:bg-navy-800/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-400" />
            <span className="text-white font-semibold">Integration Guide</span>
            <span className="text-xs px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded">REST API</span>
          </div>
          {showDocs ? <ChevronUp className="w-4 h-4 text-navy-400" /> : <ChevronDown className="w-4 h-4 text-navy-400" />}
        </button>

        {showDocs && (
          <div className="border-t border-navy-800 p-5 space-y-5">

            {/* Batch highlight box */}
            <div className="bg-blue-900/20 border border-blue-500/20 rounded p-3 text-xs text-blue-300">
              <span className="font-bold text-blue-200">High-throughput batch endpoint:</span>{" "}
              <code className="font-mono bg-navy-800 px-1 rounded">POST {baseUrl}/api/ingest/batch</code>
              {" "}— send up to <strong>500 transactions per call</strong>.
              At ~2 calls/sec that's <strong>~60,000 txns/min</strong> or <strong>200k in ~3 minutes</strong>.
              Body: <code className="font-mono bg-navy-800 px-1 rounded">{`{ "transactions": [...] }`}</code>
              <button onClick={() => copyText(`${baseUrl}/api/ingest/batch`, "Batch URL")} className="ml-2 underline hover:text-blue-100">copy URL</button>
            </div>

            {/* Endpoint */}
            <div>
              <p className="text-navy-400 text-xs uppercase tracking-wider mb-2">Endpoint</p>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-safe/10 border border-safe/20 text-safe text-xs font-bold rounded">POST</span>
                <code
                  className="flex-1 text-xs font-mono text-navy-200 bg-navy-800 px-3 py-2 rounded cursor-pointer hover:bg-navy-700 transition-colors"
                  onClick={() => copyText(`${baseUrl}/api/ingest`, "Endpoint URL")}
                  title="Click to copy"
                >
                  {baseUrl}/api/ingest
                </code>
                <button
                  onClick={() => copyText(`${baseUrl}/api/ingest`, "Endpoint URL")}
                  className="p-1.5 rounded bg-navy-800 hover:bg-navy-700 text-navy-400 hover:text-navy-200 transition-colors shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Auth */}
            <div>
              <p className="text-navy-400 text-xs uppercase tracking-wider mb-2">Authentication</p>
              <div className="bg-navy-800 rounded p-3 text-xs font-mono text-navy-300">
                <span className="text-blue-400">Authorization</span>: Bearer{" "}
                <span className="text-warning">{firstActiveKey ? firstActiveKey.key.slice(0, 16) + "..." : "<your-api-key>"}</span>
              </div>
            </div>

            {/* Fields */}
            <div>
              <p className="text-navy-400 text-xs uppercase tracking-wider mb-2">Request Body (JSON)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-navy-700">
                      <th className="text-left py-2 pr-4 text-navy-400 font-medium">Field</th>
                      <th className="text-left py-2 pr-4 text-navy-400 font-medium">Type</th>
                      <th className="text-left py-2 pr-4 text-navy-400 font-medium">Required</th>
                      <th className="text-left py-2 text-navy-400 font-medium">Values / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-800">
                    {[
                      { field: "amount", type: "number", req: true, note: "Transaction amount in ZAR" },
                      { field: "type", type: "string", req: true, note: "DEBIT | CREDIT | TRANSFER | PAYMENT" },
                      { field: "channel", type: "string", req: true, note: "ATM | ONLINE | POS | MOBILE | EFT" },
                      { field: "accountNumber", type: "string", req: true, note: "Customer account number" },
                      { field: "accountHolder", type: "string", req: true, note: "Full name of account holder" },
                      { field: "bankCode", type: "string", req: true, note: "e.g. ABSA, FNB, Nedbank" },
                      { field: "merchantCountry", type: "string", req: true, note: "ISO 3166-1 alpha-2, e.g. ZA, NG" },
                      { field: "merchantName", type: "string", req: false, note: "Name of merchant" },
                      { field: "merchantCity", type: "string", req: false, note: "City of merchant" },
                      { field: "ipAddress", type: "string", req: false, note: "Client IP address" },
                      { field: "deviceId", type: "string", req: false, note: "Unique device fingerprint" },
                      { field: "latitude", type: "number", req: false, note: "GPS latitude" },
                      { field: "longitude", type: "number", req: false, note: "GPS longitude" },
                      { field: "externalId", type: "string", req: false, note: "Your internal transaction ID" },
                    ].map((row) => (
                      <tr key={row.field}>
                        <td className="py-2 pr-4 font-mono text-navy-200">{row.field}</td>
                        <td className="py-2 pr-4 text-blue-400">{row.type}</td>
                        <td className="py-2 pr-4">
                          {row.req
                            ? <span className="text-accent font-semibold">Yes</span>
                            : <span className="text-navy-500">No</span>}
                        </td>
                        <td className="py-2 text-navy-400">{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Example */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-navy-400 text-xs uppercase tracking-wider">Example Request (curl)</p>
                <button
                  onClick={() => copyText(
                    `curl -X POST ${baseUrl}/api/ingest \\\n  -H "Authorization: Bearer ${firstActiveKey?.key ?? "<your-api-key>"}" \\\n  -H "Content-Type: application/json" \\\n  -d '${EXAMPLE_PAYLOAD}'`,
                    "curl command"
                  )}
                  className="flex items-center gap-1 text-xs text-navy-400 hover:text-navy-200 transition-colors"
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
              <pre className="bg-navy-800 rounded p-3 text-xs font-mono text-navy-300 overflow-x-auto whitespace-pre-wrap">
{`curl -X POST ${baseUrl}/api/ingest \\
  -H "Authorization: Bearer ${firstActiveKey?.key ?? "<your-api-key>"}" \\
  -H "Content-Type: application/json" \\
  -d '${EXAMPLE_PAYLOAD}'`}
              </pre>
            </div>

            {/* Response */}
            <div>
              <p className="text-navy-400 text-xs uppercase tracking-wider mb-2">Response (200 OK)</p>
              <pre className="bg-navy-800 rounded p-3 text-xs font-mono text-navy-300 overflow-x-auto">
{`{
  "transactionId": "jx7abc123...",
  "riskScore": 65,
  "riskLevel": "HIGH",
  "fraudFlags": ["NEW_DEVICE", "ACCOUNT_TAKEOVER_SIGNAL"],
  "organisationId": "jx7org456..."
}`}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-navy-900 border border-navy-700 rounded-container p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Generate API Key</h2>
              <button onClick={() => setShowCreate(false)} className="text-navy-500 hover:text-navy-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="text-navy-400 text-xs mb-1 block">Key Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-sm text-navy-200 placeholder-navy-500 focus:outline-none focus:border-blue-500"
                placeholder="e.g. ABSA Production Integration"
                autoFocus
              />
              <p className="text-navy-500 text-xs mt-1">Give it a descriptive name so you know which system uses it.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 bg-navy-800 border border-navy-700 text-navy-300 text-sm rounded hover:bg-navy-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="flex-1 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded transition-colors disabled:opacity-50"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
