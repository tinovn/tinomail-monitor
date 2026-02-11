import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ActiveAlertsSortableDataTable } from "@/components/alerts/active-alerts-sortable-data-table";
import type { SortingState } from "@tanstack/react-table";

export const Route = createFileRoute("/_authenticated/alerts/")({
  component: AlertsPage,
});

function AlertsPage() {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [activeTab, setActiveTab] = useState<"active" | "history" | "rules" | "channels">("active");

  const tabs = [
    { id: "active" as const, label: "Active Alerts", path: "/alerts" },
    { id: "history" as const, label: "History", path: "/alerts/history" },
    { id: "rules" as const, label: "Rules", path: "/alerts/rules" },
    { id: "channels" as const, label: "Channels", path: "/alerts/channels" },
  ];

  return (
    <div className="space-y-3">
      {/* Tab Navigation */}
      <div className="border-b border-border">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.path !== "/alerts") {
                  navigate({ to: tab.path });
                }
              }}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-500"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Active Alerts Content */}
      <ActiveAlertsSortableDataTable sorting={sorting} onSortingChange={setSorting} />
    </div>
  );
}
