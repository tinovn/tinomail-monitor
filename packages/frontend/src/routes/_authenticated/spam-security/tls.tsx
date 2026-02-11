import { createFileRoute } from "@tanstack/react-router";
import { TlsConnectionPercentageGauge } from "@/components/spam-security/tls-connection-percentage-gauge";
import { TlsVersionDistributionPieChart } from "@/components/spam-security/tls-version-distribution-pie-chart";

export const Route = createFileRoute("/_authenticated/spam-security/tls")({
  component: TlsMonitoringPage,
});

function TlsMonitoringPage() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-surface p-3">
          <TlsConnectionPercentageGauge />
        </div>

        <div className="rounded-md border border-border bg-surface p-3">
          <TlsVersionDistributionPieChart />
        </div>
      </div>
    </div>
  );
}
