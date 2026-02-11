import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RspamdSummaryStatCards } from "@/components/spam-security/rspamd-summary-stat-cards";
import { RspamdSpamTrendAreaChart } from "@/components/spam-security/rspamd-spam-trend-area-chart";
import { RspamdActionBreakdownBarChart } from "@/components/spam-security/rspamd-action-breakdown-bar-chart";
import { RspamdLearningProgressCards } from "@/components/spam-security/rspamd-learning-progress-cards";
import { cn } from "@/lib/classname-utils";

export const Route = createFileRoute("/_authenticated/spam-security/")({
  component: SpamSecurityRspamdPage,
});

type TabType = "rspamd" | "authentication" | "tls";

function SpamSecurityRspamdPage() {
  const [activeTab, setActiveTab] = useState<TabType>("rspamd");

  const tabs = [
    { id: "rspamd" as const, label: "Rspamd" },
    { id: "authentication" as const, label: "Authentication" },
    { id: "tls" as const, label: "TLS" },
  ];

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors border-b-2",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rspamd Tab */}
      {activeTab === "rspamd" && (
        <div className="space-y-3">
          <RspamdSummaryStatCards />

          <div className="rounded-md border border-border bg-surface p-3">
            <RspamdSpamTrendAreaChart />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-md border border-border bg-surface p-3">
              <RspamdActionBreakdownBarChart />
            </div>

            <div className="rounded-md border border-border bg-surface p-3">
              <RspamdLearningProgressCards />
            </div>
          </div>
        </div>
      )}

      {/* Placeholder tabs */}
      {activeTab === "authentication" && (
        <div className="flex items-center justify-center rounded-lg border border-border bg-surface p-12">
          <p className="text-muted-foreground">Authentication monitoring</p>
        </div>
      )}

      {activeTab === "tls" && (
        <div className="flex items-center justify-center rounded-lg border border-border bg-surface p-12">
          <p className="text-muted-foreground">TLS monitoring</p>
        </div>
      )}
    </div>
  );
}
