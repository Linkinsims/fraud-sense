import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { Id } from "../convex/_generated/dataModel";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Alerts from "./pages/Alerts";
import Cases from "./pages/Cases";
import Rules from "./pages/Rules";
import ApiKeys from "./pages/ApiKeys";
import Sidebar from "./components/Sidebar";
import { ShieldAlert } from "lucide-react";

export default function App() {
  return (
    <div className="min-h-screen bg-navy-950 text-navy-100">
      <AuthenticatedApp />
      <Toaster theme="dark" position="top-right" />
    </div>
  );
}

function AuthenticatedApp() {
  const getOrCreate = useMutation(api.organisations.getOrCreate);
  const org = useQuery(api.organisations.get);
  const [orgId, setOrgId] = useState<Id<"organisations"> | null>(null);
  const [activePage, setActivePage] = useState("dashboard");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOrCreate()
      .then((res) => {
        console.log("Org initialized:", res);
      })
      .catch((err) => {
        console.error("Failed to initialize org:", err);
        setError(err.message);
      });
  }, []);

  useEffect(() => {
    if (org) {
      setOrgId(org._id);
    }
  }, [org]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
          <ShieldAlert className="w-12 h-12 text-red-500" />
          <p className="text-white font-bold">Initialization Error</p>
          <p className="text-navy-400 text-sm">{error}</p>
          <p className="text-navy-500 text-xs mt-4">
            Check your Vercel and Convex environment variables.
          </p>
        </div>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950">
        <div className="flex flex-col items-center gap-4">
          <ShieldAlert className="w-12 h-12 text-accent shield-pulse" />
          <p className="text-navy-400">Initialising FraudSense...</p>
          <div className="text-navy-600 text-[10px] mt-2 flex flex-col items-center gap-1">
            <p>Backend URL: {import.meta.env.VITE_CONVEX_URL ? "Set" : "Missing"}</p>
            <p>Data Status: {org === undefined ? "Loading..." : org === null ? "Not Found" : "Ready"}</p>
          </div>
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
    </div>
  );
}
