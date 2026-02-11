import { createFileRoute } from "@tanstack/react-router";
import { DeliveryTimeGaugeSet } from "@/components/email-flow/delivery-time-gauge-set";
import { DeliveryTimeHistogramChart } from "@/components/email-flow/delivery-time-histogram-chart";

export const Route = createFileRoute("/_authenticated/email-flow/performance")({
  component: PerformancePage,
});

function PerformancePage() {
  return (
    <div className="space-y-3">
      {/* Gauges */}
      <div className="rounded-md border border-border bg-surface p-3">
        <DeliveryTimeGaugeSet />
      </div>

      {/* Histogram */}
      <div className="rounded-md border border-border bg-surface p-3">
        <DeliveryTimeHistogramChart />
      </div>
    </div>
  );
}
