import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DashboardUserCrudDataTable } from "@/components/admin/dashboard-user-crud-data-table";
import { SystemSettingsFormPanel } from "@/components/admin/system-settings-form-panel";
import { AuditLogSearchableDataTable } from "@/components/admin/audit-log-searchable-data-table";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminPage,
});

function AdminPage() {
  const [activeTab, setActiveTab] = useState<"users" | "settings" | "audit">("users");

  const tabs = [
    { id: "users" as const, label: "User Management" },
    { id: "settings" as const, label: "Settings" },
    { id: "audit" as const, label: "Audit Log" },
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
        {activeTab === "users" && <DashboardUserCrudDataTable />}
        {activeTab === "settings" && <SystemSettingsFormPanel />}
        {activeTab === "audit" && <AuditLogSearchableDataTable />}
      </div>
    </div>
  );
}
