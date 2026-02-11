import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

interface ActivityDataPoint {
  timestamp: string;
  sent: number;
  received: number;
}

interface MailUserActivityTrendChartProps {
  data: ActivityDataPoint[];
}

export function MailUserActivityTrendChart({
  data,
}: MailUserActivityTrendChartProps) {
  const timestamps = data.map((d) =>
    new Date(d.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  );
  const sentData = data.map((d) => d.sent);
  const receivedData = data.map((d) => d.received);

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(17, 24, 39, 0.95)",
      borderColor: "#374151",
      textStyle: { color: "#f3f4f6" },
    },
    legend: {
      data: ["Sent", "Received"],
      textStyle: { color: "#9ca3af" },
      top: 0,
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      top: "15%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: timestamps,
      axisLine: { lineStyle: { color: "#374151" } },
      axisLabel: { color: "#9ca3af" },
    },
    yAxis: [
      {
        type: "value",
        name: "Sent",
        position: "left",
        axisLine: { lineStyle: { color: "#374151" } },
        axisLabel: { color: "#9ca3af" },
        splitLine: { lineStyle: { color: "#374151", type: "dashed" } },
      },
      {
        type: "value",
        name: "Received",
        position: "right",
        axisLine: { lineStyle: { color: "#374151" } },
        axisLabel: { color: "#9ca3af" },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "Sent",
        type: "line",
        yAxisIndex: 0,
        data: sentData,
        smooth: true,
        lineStyle: { color: "#3b82f6", width: 2 },
        itemStyle: { color: "#3b82f6" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(59, 130, 246, 0.3)" },
              { offset: 1, color: "rgba(59, 130, 246, 0.05)" },
            ],
          },
        },
      },
      {
        name: "Received",
        type: "line",
        yAxisIndex: 1,
        data: receivedData,
        smooth: true,
        lineStyle: { color: "#10b981", width: 2 },
        itemStyle: { color: "#10b981" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(16, 185, 129, 0.3)" },
              { offset: 1, color: "rgba(16, 185, 129, 0.05)" },
            ],
          },
        },
      },
    ],
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-4 text-sm font-semibold text-foreground">
        Activity Trend (7 Days)
      </h3>
      <ReactECharts option={option} style={{ height: "300px" }} />
    </div>
  );
}
