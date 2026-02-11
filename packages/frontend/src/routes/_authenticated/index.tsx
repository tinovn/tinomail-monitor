import { createFileRoute } from "@tanstack/react-router";
import { OverviewNodeSummaryPulseTable } from "@/components/overview/overview-node-summary-pulse-table";
import { OverviewStatusBar } from "@/components/overview/overview-status-bar";
import { EmailThroughputAreaChart } from "@/components/overview/email-throughput-area-chart";
import { BounceRateTrendLineChart } from "@/components/overview/bounce-rate-trend-line-chart";
import { TopSendingDomainsHorizontalBarChart } from "@/components/overview/top-sending-domains-horizontal-bar-chart";
import { RecentAlertsListPanel } from "@/components/overview/recent-alerts-list-panel";

export const Route = createFileRoute("/_authenticated/")({
  component: OverviewDashboard,
});

function OverviewDashboard() {
  return (
    <div className="space-y-3">
      {/* Node Summary Table — hero component */}
      <OverviewNodeSummaryPulseTable />

      {/* Compact stat row — 6 inline stats */}
      <OverviewStatusBar />

      {/* Two-column: Chart + Alerts */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-surface p-3">
          <EmailThroughputAreaChart />
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <RecentAlertsListPanel />
        </div>
      </div>

      {/* Bottom row: Bounce rate + Top domains */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-surface p-3">
          <BounceRateTrendLineChart />
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <TopSendingDomainsHorizontalBarChart />
        </div>
      </div>
    </div>
  );
}
