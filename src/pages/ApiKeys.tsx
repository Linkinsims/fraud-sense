import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";
import { Key, Plus, Copy, EyeOff, Eye, ShieldOff, X, Terminal, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface Props {
  orgId: string;
}

function timeAgo(dateString: string) {
  const ts = new Date(dateString).getTime();
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString("en-ZA");
}

export default function ApiKeys({ orgId }: Props) {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [showDocs, setShowDocs] = useState(true);

  useEffect(() => {
    async function fetchKeys() {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false });

      if (error) console.error("Error fetching keys:", error);
      else setKeys(data || []);
      setLoading(false);
    }

    fetchKeys();

    const subscription = supabase
      .channel('api_keys_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'api_keys', filter: `organisation_id=eq.${orgId}` }, 
        (payload) => {
          if (payload.eventType === 'INSERT') setKeys(prev => [payload.new, ...prev]);
          else if (payload.eventType === 'UPDATE') setKeys(prev => prev.map(k => k.id === payload.new.id ? payload.new : k));
          else if (payload.eventType === 'DELETE') setKeys(prev => prev.filter(k => k.id !== payload.old.id));
        }
      ).subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [orgId]);

  async function handleCreate() {
    if (!newName.trim()) return;
    const key = `fs_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    const { error } = await supabase.from('api_keys').insert({
      organisation_id: orgId,
      name: newName,
      key: key,
      active: true
    });

    if (error) {
      console.error("Error creating key:", error);
      toast.error("Failed to create API key");
    } else {
      setNewName("");
      setShowCreate(false);
      toast.success("API key created successfully");
    }
  }

  async function revokeKey(id: string) {
    const { error } = await supabase.from('api_keys').update({ active: false }).eq('id', id);
    if (error) {
      console.error("Error revoking key:", error);
      toast.error("Failed to revoke key");
    } else {
      toast.success("API key revoked");
    }
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

  const activeCount = keys?.filter((k) => k.active).length ?? 0;
  const firstActiveKey = keys?.find((k) => k.active);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">API Keys</h1>
          <p className="text-navy-400 text-sm mt-0.5">{loading ? "Loading..." : `${activeCount} active key${activeCount !== 1 ? "s" : ""}`}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded transition-colors"
        >
          <Plus className="w-4 h-4" /> Generate Key
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-navy-500">Loading keys...</div>
        ) : keys?.length === 0 && (
          <div className="text-center py-8 text-navy-500">
            <Key className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No API keys yet. Generate one to start ingesting transactions.</p>
          </div>
        )}
        {keys?.map((k) => (
          <div
            key={k.id}
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
                    {revealed.has(k.id) ? k.key : k.key.slice(0, 12) + "••••••••••••••••••••"}
                  </code>
                  <button
                    onClick={() => toggleReveal(k.id)}
                    className="p-1.5 rounded bg-navy-800 hover:bg-navy-700 text-navy-400 hover:text-navy-200 transition-colors shrink-0"
                  >
                    {revealed.has(k.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  {k.active && (
                    <button
                      onClick={() => copyKey(k.key)}
                      className="p-1.5 rounded bg-navy-800 hover:bg-navy-700 text-navy-400 hover:text-navy-200 transition-colors shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-navy-500 text-xs mt-1">
                  Created {timeAgo(k.created_at)}
                  {k.last_used ? ` · Last used ${timeAgo(k.last_used)}` : " · Never used"}
                </p>
              </div>
              {k.active && (
                <button
                  onClick={() => revokeKey(k.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 border border-accent/20 text-accent text-xs rounded hover:bg-accent/20 transition-colors shrink-0"
                >
                  <ShieldOff className="w-3.5 h-3.5" /> Revoke
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-navy-900 border border-navy-700 rounded-container p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">New API Key</h2>
              <button onClick={() => setShowCreate(false)} className="text-navy-500 hover:text-navy-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="text-navy-400 text-xs mb-1 block">Key Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-sm text-navy-200 placeholder-navy-500 focus:outline-none focus:border-blue-500"
                placeholder="e.g. Production Backend"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="w-full py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-bold rounded transition-colors"
            >
              Generate Key
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
