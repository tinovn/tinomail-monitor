import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface RamDataPoint {
  time: Date;
  usedPercent: number;
  freePercent: number;
}

interface RamUsageStackedAreaChartProps {
  nodeId: string;
}

export function RamUsageStackedAreaChart({ nodeId }: RamUsageStackedAreaChartProps) {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data, isLoading } = useQuery({
    queryKey: ["node-ram", nodeId, from, to],
    queryFn: () =>
      apiClient.get<RamDataPoint[]>(`/metrics/node/${nodeId}/ram`, {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
    },
    legend: {
      data: ["Used", "Free"],
      textStyle: { color: "oklch(0.895 0.013 285)" },
    },
    xAxis: {
      type: "time",
      axisLabel: { color: "oklch(0.895 0.013 285)" },
    },
    yAxis: {
      type: "value",
      name: "Memory (%)",
      max: 100,
      axisLabel: {
        color: "oklch(0.895 0.013 285)",
        formatter: "{value}%",
      },
    },
    series: [
      {
        name: "Used",
        type: "line",
        stack: "total",
        areaStyle: { opacity: 0.6 },
        data: (data || []).map((d) => [d.time, d.usedPercent]),
        color: "oklch(0.70 0.20 25)",
        smooth: true,
      },
      {
        name: "Free",
        type: "line",
        stack: "total",
        areaStyle: { opacity: 0.6 },
        data: (data || []).map((d) => [d.time, d.freePercent]),
        color: "oklch(0.72 0.19 142)",
        smooth: true,
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={isLoading} height={300} />;
}
