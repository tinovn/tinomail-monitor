import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

interface HeatmapDataPoint {
  hour: number;
  weekday: number;
  value: number;
}

interface DomainSendingPatternHeatmapChartProps {
  data: HeatmapDataPoint[];
  title?: string;
}

export function DomainSendingPatternHeatmapChart({
  data,
  title = "Sending Pattern (by Hour & Weekday)",
}: DomainSendingPatternHeatmapChartProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const heatmapData = data.map((d) => [d.hour, d.weekday, d.value]);

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      position: "top",
      backgroundColor: "rgba(17, 24, 39, 0.95)",
      borderColor: "#374151",
      textStyle: { color: "#f3f4f6" },
      formatter: (params: any) => {
        const [hour, weekday, value] = params.data;
        return `${weekdays[weekday]} ${hour}:00<br/>Volume: ${value.toLocaleString()}`;
      },
    },
    grid: {
      left: "10%",
      right: "5%",
      bottom: "10%",
      top: "5%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: hours,
      splitArea: { show: true },
      axisLabel: {
        color: "#9ca3af",
        formatter: (value: string) => `${value}h`,
      },
      axisLine: { lineStyle: { color: "#374151" } },
    },
    yAxis: {
      type: "category",
      data: weekdays,
      splitArea: { show: true },
      axisLabel: { color: "#9ca3af" },
      axisLine: { lineStyle: { color: "#374151" } },
    },
    visualMap: {
      min: 0,
      max: maxValue,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: "0%",
      textStyle: { color: "#9ca3af" },
      inRange: {
        color: ["#1e3a8a", "#3b82f6", "#60a5fa", "#93c5fd", "#dbeafe"],
      },
    },
    series: [
      {
        name: "Email Volume",
        type: "heatmap",
        data: heatmapData,
        label: { show: false },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: "rgba(0, 0, 0, 0.5)",
          },
        },
      },
    ],
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      <ReactECharts option={option} style={{ height: "350px" }} />
    </div>
  );
}
