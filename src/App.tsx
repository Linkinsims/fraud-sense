import { Authenticated, Unauthenticated, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
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
      <Authenticated>
        <AuthenticatedApp />
      </Authenticated>
      <Unauthenticated>
        <LoginPage />
      </Unauthenticated>
      <Toaster theme="dark" position="top-right" />
    </div>
  );
}

function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative">
              <ShieldAlert className="w-12 h-12 text-accent shield-pulse" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">FraudSense SA</h1>
              <p className="text-navy-400 text-sm">Real-Time Fraud Detection Engine</p>
            </div>
          </div>
          <p className="text-navy-400 text-sm">
            Protecting South African financial institutions
          </p>
        </div>
        <div className="bg-navy-900 border border-navy-700 rounded-container p-8 shadow-xl">
          <SignInForm />
        </div>
        <p className="text-center text-navy-500 text-xs mt-6">
          Trusted by banks, fintechs & payment processors across SA
        </p>
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  const getOrCreate = useMutation(api.organisations.getOrCreate);
  const org = useQuery(api.organisations.get);
  const [orgId, setOrgId] = useState<Id<"organisations"> | null>(null);
  const [activePage, setActivePage] = useState("dashboard");

  useEffect(() => {
    getOrCreate().then(() => {});
  }, []);

  useEffect(() => {
    if (org) setOrgId(org._id);
  }, [org]);

  if (!orgId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950">
        <div className="flex flex-col items-center gap-4">
          <ShieldAlert className="w-12 h-12 text-accent shield-pulse" />
          <p className="text-navy-400">Initialising FraudSense...</p>
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

