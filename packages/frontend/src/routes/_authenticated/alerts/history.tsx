import { createFileRoute } from "@tanstack/react-router";
import { AlertHistoryPaginatedTimelineList } from "@/components/alerts/alert-history-paginated-timeline-list";
import { AlertFrequency30DayStackedBarChart } from "@/components/alerts/alert-frequency-30day-stacked-bar-chart";

export const Route = createFileRoute("/_authenticated/alerts/history")({
  component: AlertHistoryPage,
});

function AlertHistoryPage() {
  return (
    <div className="space-y-3">
      {/* Alert Frequency Chart */}
      <AlertFrequency30DayStackedBarChart />

      {/* Alert History Timeline */}
      <AlertHistoryPaginatedTimelineList />
    </div>
  );
}
