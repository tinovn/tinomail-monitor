import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface ComparisonDataPoint {
  time: Date;
  nodeId: string;
  value: number;
}

interface MultiNodeComparisonOverlayChartProps {
  nodeIds: string[];
  metric: string;
}

export function MultiNodeComparisonOverlayChart({
  nodeIds,
  metric,
}: MultiNodeComparisonOverlayChartProps) {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data, isLoading } = useQuery({
    queryKey: ["node-comparison", nodeIds, metric, from, to],
    queryFn: () =>
      apiClient.get<ComparisonDataPoint[]>("/nodes/comparison", {
        nodes: nodeIds.join(","),
        metric,
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
    enabled: nodeIds.length > 0,
  });

  const colors = [
    "oklch(0.65 0.25 250)",
    "oklch(0.72 0.19 142)",
    "oklch(0.70 0.20 25)",
    "oklch(0.85 0.15 85)",
    "oklch(0.60 0.20 300)",
  ];

  const groupedData = (data || []).reduce(
    (acc, point) => {
      if (!acc[point.nodeId]) {
        acc[point.nodeId] = [];
      }
      acc[point.nodeId].push([point.time, point.value]);
      return acc;
    },
    {} as Record<string, Array<[Date, number]>>,
  );

  const series = Object.entries(groupedData).map(([nodeId, points], index) => ({
    name: nodeId,
    type: "line" as const,
    data: points,
    color: colors[index % colors.length],
    smooth: true,
  }));

  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
    },
    legend: {
      data: Object.keys(groupedData),
      textStyle: { color: "oklch(0.895 0.013 285)" },
    },
    xAxis: {
      type: "time",
      axisLabel: { color: "oklch(0.895 0.013 285)" },
    },
    yAxis: {
      type: "value",
      name: metric.toUpperCase(),
      axisLabel: { color: "oklch(0.895 0.013 285)" },
    },
    series,
  };

  return <EchartsBaseWrapper option={option} loading={isLoading} height={400} />;
}
