import { useQuery } from "@tanstack/react-query";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";

echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

interface AlertFrequencyData {
  date: string;
  critical: number;
  warning: number;
  info: number;
}

export function AlertFrequency30DayStackedBarChart() {
  const { data = [], isLoading } = useQuery<AlertFrequencyData[]>({
    queryKey: ["alerts", "frequency"],
    queryFn: () => apiClient.get("/alerts/frequency"),
  });

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      borderColor: "#333",
      textStyle: { color: "#fff" },
    },
    legend: {
      data: ["Critical", "Warning", "Info"],
      textStyle: { color: "#999" },
      top: 0,
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      top: "40px",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: data.map((d) => d.date),
      axisLine: { lineStyle: { color: "#333" } },
      axisLabel: {
        color: "#999",
        rotate: 45,
        formatter: (value: string) => {
          const date = new Date(value);
          return `${date.getMonth() + 1}/${date.getDate()}`;
        },
      },
    },
    yAxis: {
      type: "value",
      axisLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#999" },
      splitLine: { lineStyle: { color: "#333", type: "dashed" } },
    },
    series: [
      {
        name: "Critical",
        type: "bar",
        stack: "total",
        data: data.map((d) => d.critical),
        itemStyle: { color: "#ef4444" },
      },
      {
        name: "Warning",
        type: "bar",
        stack: "total",
        data: data.map((d) => d.warning),
        itemStyle: { color: "#eab308" },
      },
      {
        name: "Info",
        type: "bar",
        stack: "total",
        data: data.map((d) => d.info),
        itemStyle: { color: "#3b82f6" },
      },
    ],
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-md border border-border bg-surface p-12">
        <p className="text-muted-foreground">Loading chart...</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <h3 className="text-lg font-semibold mb-4">Alert Frequency (30 Days)</h3>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: "300px" }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
}
