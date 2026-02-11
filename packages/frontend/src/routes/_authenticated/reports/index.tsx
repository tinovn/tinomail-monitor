import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ReportDailyDetailPanel } from "@/components/reports/report-daily-detail-panel";
import { ReportHistoryListTable } from "@/components/reports/report-history-list-table";
import { DataExportFormPanel } from "@/components/reports/data-export-form-panel";

export const Route = createFileRoute("/_authenticated/reports/")({
  component: ReportsPage,
});

function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "monthly" | "ip" | "history" | "export">("daily");

  const tabs = [
    { id: "daily" as const, label: "Daily Report" },
    { id: "weekly" as const, label: "Weekly Report" },
    { id: "monthly" as const, label: "Monthly Report" },
    { id: "ip" as const, label: "IP Reputation" },
    { id: "history" as const, label: "History" },
    { id: "export" as const, label: "Export Data" },
  ];

  return (
    <div className="space-y-3">
      {/* Tab Navigation */}
      <div className="border-b border-border">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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

      {/* Tab Content */}
      <div>
        {activeTab === "daily" && <ReportDailyDetailPanel reportType="daily" />}
        {activeTab === "weekly" && <ReportDailyDetailPanel reportType="weekly" />}
        {activeTab === "monthly" && <ReportDailyDetailPanel reportType="monthly" />}
        {activeTab === "ip" && <ReportDailyDetailPanel reportType="ip-reputation" />}
        {activeTab === "history" && <ReportHistoryListTable />}
        {activeTab === "export" && <DataExportFormPanel />}
      </div>
    </div>
  );
}
