import { createFileRoute } from "@tanstack/react-router";
import { QueueOverviewCard } from "@/components/email-flow/queue-overview-card";
import { QueuePerNodeBarChart } from "@/components/email-flow/queue-per-node-bar-chart";
import { DeferredReasonsPieChart } from "@/components/email-flow/deferred-reasons-pie-chart";

export const Route = createFileRoute("/_authenticated/email-flow/queue")({
  component: QueuePage,
});

function QueuePage() {
  return (
    <div className="space-y-3">
      {/* Overview */}
      <QueueOverviewCard />

      {/* Per Node */}
      <div className="rounded-md border border-border bg-surface p-3">
        <QueuePerNodeBarChart />
      </div>

      {/* Deferred Reasons */}
      <div className="rounded-md border border-border bg-surface p-3">
        <DeferredReasonsPieChart />
      </div>
    </div>
  );
}
