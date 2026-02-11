import { ChevronDown, RefreshCw, LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth-session-store";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { useSidebarStore } from "@/stores/sidebar-navigation-store";
import { TimeRangePicker } from "./time-range-picker";
import { ActiveAlertCountBellIconBadge } from "@/components/alerts/active-alert-count-bell-icon-badge";
import { cn } from "@/lib/classname-utils";

export function AppHeaderBar() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { autoRefresh, setAutoRefresh } = useTimeRangeStore();
  const { toggleCollapse } = useSidebarStore();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const refreshIntervals = [
    { value: false as const, label: "Off" },
    { value: 15 as const, label: "15s" },
    { value: 30 as const, label: "30s" },
    { value: 60 as const, label: "1m" },
    { value: 300 as const, label: "5m" },
  ];

  return (
    <header className="flex h-10 items-center justify-between border-b border-border bg-surface px-3">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleCollapse}
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-4 w-4" />
        </button>
        <h1 className="text-sm font-semibold text-foreground">
          TinoMail Monitor
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <TimeRangePicker />

        <button
          onClick={() => navigate({ to: "/alerts" })}
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="View alerts"
        >
          <ActiveAlertCountBellIconBadge />
        </button>

        <div className="flex items-center gap-2">
          <RefreshCw
            className={cn(
              "h-4 w-4 text-muted-foreground",
              autoRefresh && "animate-spin",
            )}
          />
          <select
            value={autoRefresh === false ? "off" : autoRefresh}
            onChange={(e) => {
              const val = e.target.value;
              setAutoRefresh(val === "off" ? false : Number(val) as any);
            }}
            className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {refreshIntervals.map((item) => (
              <option
                key={String(item.value)}
                value={item.value === false ? "off" : item.value}
              >
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded px-3 py-1.5 text-sm hover:bg-muted"
          >
            <span className="text-foreground">{user?.username}</span>
            <span className="text-xs text-muted-foreground">
              ({user?.role})
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-border bg-surface shadow-lg">
                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
