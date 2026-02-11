import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { Node } from "@tinomail/shared";
import { apiClient } from "@/lib/api-http-client";
import { MultiNodeComparisonOverlayChart } from "@/components/servers/multi-node-comparison-overlay-chart";

export const Route = createFileRoute("/_authenticated/servers/comparison")({
  component: ServerComparisonPage,
});

function ServerComparisonPage() {
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>("cpu");

  const { data: nodes } = useQuery({
    queryKey: ["nodes"],
    queryFn: () => apiClient.get<Node[]>("/nodes"),
  });

  const handleNodeToggle = (nodeId: string) => {
    setSelectedNodes((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId],
    );
  };

  const metrics = [
    { value: "cpu", label: "CPU Usage" },
    { value: "ram", label: "RAM Usage" },
    { value: "disk", label: "Disk Usage" },
    { value: "load", label: "System Load" },
    { value: "network_rx", label: "Network RX" },
    { value: "network_tx", label: "Network TX" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Server Comparison</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compare metrics across multiple servers
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Select Nodes</h2>
          <div className="space-y-2">
            {(nodes || []).map((node) => (
              <label key={node.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedNodes.includes(node.id)}
                  onChange={() => handleNodeToggle(node.id)}
                  className="h-4 w-4"
                />
                <span className="text-sm text-foreground">{node.id}</span>
              </label>
            ))}
          </div>

          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Select Metric</h3>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground"
            >
              {metrics.map((metric) => (
                <option key={metric.value} value={metric.value}>
                  {metric.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 lg:col-span-3">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Comparison Chart</h2>
          {selectedNodes.length === 0 ? (
            <div className="flex h-96 items-center justify-center text-muted-foreground">
              Select at least one node to compare
            </div>
          ) : (
            <MultiNodeComparisonOverlayChart
              nodeIds={selectedNodes}
              metric={selectedMetric}
            />
          )}
        </div>
      </div>
    </div>
  );
}
