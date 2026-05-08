import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { supabase } from "./lib/supabase";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Alerts from "./pages/Alerts";
import Cases from "./pages/Cases";
import Rules from "./pages/Rules";
import ApiKeys from "./pages/ApiKeys";
import Sidebar from "./components/Sidebar";
import { ShieldAlert } from "lucide-react";

export default function App() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState("dashboard");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initApp() {
      try {
        const PUBLIC_USER_ID = "public_user";
        
        // Try to find existing org
        const { data: existingOrg, error: fetchError } = await supabase
          .from('organisations')
          .select('id')
          .eq('owner_id', PUBLIC_USER_ID)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          throw fetchError;
        }

        if (existingOrg) {
          setOrgId(existingOrg.id);
        } else {
          // Create new org if not found
          const { data: newOrg, error: createError } = await supabase
            .from('organisations')
            .insert({
              name: "My Organisation",
              type: "FINTECH",
              plan: "STARTER",
              owner_id: PUBLIC_USER_ID
            })
            .select()
            .single();

          if (createError) throw createError;
          
          // Seed default rules
          const defaultRules = [
            { name: "High Amount Alert", description: "Flag transactions over R50,000", field: "amount", operator: "gt", value: 50000, action: "ALERT", severity: "HIGH", score_boost: 20, organisation_id: newOrg.id },
            { name: "Very High Amount Block", description: "Block transactions over R100,000", field: "amount", operator: "gt", value: 100000, action: "BLOCK", severity: "CRITICAL", score_boost: 40, organisation_id: newOrg.id },
            { name: "Foreign Transaction Flag", description: "Flag non-ZA transactions", field: "amount", operator: "gt", value: 5000, action: "FLAG", severity: "MEDIUM", score_boost: 15, organisation_id: newOrg.id }
          ];

          const { error: seedError } = await supabase.from('rules').insert(defaultRules);
          if (seedError) console.error("Rule seeding failed:", seedError);

          setOrgId(newOrg.id);
        }
      } catch (err: any) {
        console.error("Initialization error:", err);
        setError(err.message || "Failed to connect to Supabase");
      } finally {
        setLoading(false);
      }
    }

    initApp();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
          <ShieldAlert className="w-12 h-12 text-red-500" />
          <p className="text-white font-bold">Supabase Connection Error</p>
          <p className="text-navy-400 text-sm">{error}</p>
          <p className="text-navy-500 text-xs mt-4">
            Check your Vercel Environment Variables for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
          </p>
        </div>
      </div>
    );
  }

  if (loading || !orgId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950">
        <div className="flex flex-col items-center gap-4">
          <ShieldAlert className="w-12 h-12 text-accent shield-pulse" />
          <p className="text-navy-400">Connecting to Supabase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-navy-950">
      <Sidebar activePage={activePage} onNavigate={setActivePage} orgId={orgId} />
      <main className="flex-1 overflow-y-auto">
        {activePage === "dashboard" && <Dashboard orgId={orgId} />}
        {activePage === "transactions" && <Transactions orgId={orgId} />}
        {activePage === "alerts" && <Alerts orgId={orgId} />}
        {activePage === "cases" && <Cases orgId={orgId} />}
        {activePage === "rules" && <Rules orgId={orgId} />}
        {activePage === "apikeys" && <ApiKeys orgId={orgId} />}
      </main>
      <Toaster theme="dark" position="top-right" />
    </div>
  );
}
