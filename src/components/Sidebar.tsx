import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { SignOutButton } from "../SignOutButton";
import {
  ShieldAlert,
  LayoutDashboard,
  ArrowLeftRight,
  Bell,
  FolderOpen,
  Settings2,
  Key,
  LogOut,
} from "lucide-react";

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  orgId: Id<"organisations">;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "cases", label: "Cases", icon: FolderOpen },
  { id: "rules", label: "Rules", icon: Settings2 },
  { id: "apikeys", label: "API Keys", icon: Key },
];

export default function Sidebar({ activePage, onNavigate, orgId }: SidebarProps) {
  const unreadCount = useQuery(api.alerts.getUnreadCount, { organisationId: orgId });
  const org = useQuery(api.organisations.get);

  return (
    <aside className="w-64 bg-navy-900 border-r border-navy-800 flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="p-6 border-b border-navy-800">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-accent shield-pulse" />
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">FraudSense SA</h1>
            <p className="text-navy-500 text-xs">Detection Engine</p>
          </div>
        </div>
      </div>

      {/* Org name */}
      <div className="px-4 py-3 border-b border-navy-800">
        <p className="text-navy-500 text-xs uppercase tracking-wider mb-1">Organisation</p>
        <p className="text-navy-200 text-sm font-medium truncate">{org?.name ?? "Loading..."}</p>
        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-900/50 text-blue-400 text-xs rounded">
          {org?.plan ?? "STARTER"}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors relative ${
                isActive
                  ? "bg-accent/10 text-accent border border-accent/20"
                  : "text-navy-400 hover:text-navy-200 hover:bg-navy-800"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
              {item.id === "alerts" && unreadCount && unreadCount > 0 ? (
                <span className="ml-auto bg-accent text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="p-4 border-t border-navy-800">
        <SignOutButton />
      </div>
    </aside>
  );
}

