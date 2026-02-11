import { createFileRoute } from "@tanstack/react-router";
import { EmailFlowCounterCards } from "@/components/email-flow/email-flow-counter-cards";
import { OutboundThroughputStackedChart } from "@/components/email-flow/outbound-throughput-stacked-chart";
import { OutboundByNodeMultiChart } from "@/components/email-flow/outbound-by-node-multi-chart";

export const Route = createFileRoute("/_authenticated/email-flow/")({
  component: EmailFlowPage,
});

function EmailFlowPage() {
  return (
    <div className="space-y-3">
      {/* Counters */}
      <EmailFlowCounterCards />

      {/* Outbound Throughput Chart */}
      <div className="rounded-md border border-border bg-surface p-3">
        <OutboundThroughputStackedChart />
      </div>

      {/* By Node Chart */}
      <div className="rounded-md border border-border bg-surface p-3">
        <OutboundByNodeMultiChart />
      </div>
    </div>
  );
}
