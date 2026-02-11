import type { MtaNodePerformance } from "@tinomail/shared";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";
import type { EChartsOption } from "echarts";
import { MetricStatCard } from "@/components/shared/metric-stat-card";

interface NodePerformanceChartsTabProps {
  performance: MtaNodePerformance;
}

export function NodePerformanceChartsTab({ performance }: NodePerformanceChartsTabProps) {
  // Throughput chart
  const throughputOption: EChartsOption = {
    title: { text: "Email Throughput", left: "center" },
    tooltip: { trigger: "axis" },
    legend: { data: ["Sent", "Delivered", "Bounced"], bottom: 0 },
    xAxis: {
      type: "time",
      axisLabel: { formatter: "{HH}:{mm}" },
    },
    yAxis: { type: "value", name: "Count" },
    series: [
      {
        name: "Sent",
        type: "line",
        data: performance.throughput.map((t) => [t.time, t.sent]),
        smooth: true,
        itemStyle: { color: "#3b82f6" },
      },
      {
        name: "Delivered",
        type: "line",
        data: performance.throughput.map((t) => [t.time, t.delivered]),
        smooth: true,
        itemStyle: { color: "#10b981" },
      },
      {
        name: "Bounced",
        type: "line",
        data: performance.throughput.map((t) => [t.time, t.bounced]),
        smooth: true,
        itemStyle: { color: "#ef4444" },
      },
    ],
  };

  // Delivery status pie chart
  const deliveryPieOption: EChartsOption = {
    title: { text: "Delivery Status", left: "center" },
    tooltip: { trigger: "item" },
    legend: { bottom: 0 },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        avoidLabelOverlap: false,
        data: [
          { value: performance.deliveryStatus.delivered, name: "Delivered", itemStyle: { color: "#10b981" } },
          { value: performance.deliveryStatus.bounced, name: "Bounced", itemStyle: { color: "#ef4444" } },
          { value: performance.deliveryStatus.deferred, name: "Deferred", itemStyle: { color: "#f59e0b" } },
          { value: performance.deliveryStatus.rejected, name: "Rejected", itemStyle: { color: "#dc2626" } },
        ],
      },
    ],
  };

  // Queue trend chart
  const queueOption: EChartsOption = {
    title: { text: "Queue Size Trend", left: "center" },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "time",
      axisLabel: { formatter: "{HH}:{mm}" },
    },
    yAxis: { type: "value", name: "Queue Size" },
    series: [
      {
        type: "line",
        data: performance.queueTrend.map((q) => [q.time, q.size]),
        smooth: true,
        areaStyle: { opacity: 0.3 },
        itemStyle: { color: "#8b5cf6" },
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Resource Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricStatCard
          label="CPU Usage"
          value={`${(performance.resources.cpuUsage ?? 0).toFixed(1)}%`}
        />
        <MetricStatCard
          label="Memory Usage"
          value={`${(performance.resources.memUsage ?? 0).toFixed(1)}%`}
        />
        <MetricStatCard
          label="Network Sent"
          value={`${((performance.resources.networkSent ?? 0) / 1024 / 1024).toFixed(1)} MB`}
        />
        <MetricStatCard
          label="Network Recv"
          value={`${((performance.resources.networkRecv ?? 0) / 1024 / 1024).toFixed(1)} MB`}
        />
      </div>

      {/* Throughput Chart */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <EchartsBaseWrapper option={throughputOption} height={300} />
      </div>

      {/* Delivery Status & Queue */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <EchartsBaseWrapper option={deliveryPieOption} height={300} />
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <EchartsBaseWrapper option={queueOption} height={300} />
        </div>
      </div>
    </div>
  );
}
