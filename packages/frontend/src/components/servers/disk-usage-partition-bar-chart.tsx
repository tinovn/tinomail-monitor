import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface DiskPartition {
  partition: string;
  usedPercent: number;
  total: number;
}

interface DiskUsagePartitionBarChartProps {
  nodeId: string;
}

export function DiskUsagePartitionBarChart({ nodeId }: DiskUsagePartitionBarChartProps) {
  const autoRefresh = useTimeRangeStore((state) => state.autoRefresh);

  const { data, isLoading } = useQuery({
    queryKey: ["node-disk", nodeId],
    queryFn: () => apiClient.get<DiskPartition[]>(`/metrics/node/${nodeId}/disk`),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: any) => {
        const point = params[0];
        return `${point.name}<br/>Used: ${point.value.toFixed(1)}%`;
      },
    },
    xAxis: {
      type: "category",
      data: (data || []).map((d) => d.partition),
      axisLabel: { color: "#dbdbe5" },
    },
    yAxis: {
      type: "value",
      name: "Usage (%)",
      max: 100,
      axisLabel: {
        color: "#dbdbe5",
        formatter: "{value}%",
      },
    },
    series: [
      {
        type: "bar",
        data: (data || []).map((d) => d.usedPercent),
        color: "#008dff",
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
        },
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={isLoading} height={300} />;
}
