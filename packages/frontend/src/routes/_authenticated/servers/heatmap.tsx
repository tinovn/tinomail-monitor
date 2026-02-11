import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClusterMetricsHeatmapChart } from "@/components/servers/cluster-metrics-heatmap-chart";

export const Route = createFileRoute("/_authenticated/servers/heatmap")({
  component: ServerHeatmapPage,
});

function ServerHeatmapPage() {
  const [selectedMetric, setSelectedMetric] = useState<string>("cpu");
  const [selectedBucket, setSelectedBucket] = useState<string>("1h");

  const metrics = [
    { value: "cpu", label: "CPU Usage" },
    { value: "ram", label: "RAM Usage" },
    { value: "disk", label: "Disk Usage" },
    { value: "load", label: "System Load" },
  ];

  const buckets = [
    { value: "15m", label: "15 minutes" },
    { value: "30m", label: "30 minutes" },
    { value: "1h", label: "1 hour" },
    { value: "6h", label: "6 hours" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cluster Heatmap</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visualize metrics across all nodes over time
        </p>
      </div>

      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Metric:</label>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            {metrics.map((metric) => (
              <option key={metric.value} value={metric.value}>
                {metric.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Bucket:</label>
          <select
            value={selectedBucket}
            onChange={(e) => setSelectedBucket(e.target.value)}
            className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            {buckets.map((bucket) => (
              <option key={bucket.value} value={bucket.value}>
                {bucket.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <ClusterMetricsHeatmapChart metric={selectedMetric} bucket={selectedBucket} />
      </div>
    </div>
  );
}
