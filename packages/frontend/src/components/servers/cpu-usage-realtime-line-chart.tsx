import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface MetricDataPoint {
  time: Date;
  value: number;
}

interface CpuUsageRealtimeLineChartProps {
  nodeId: string;
}

export function CpuUsageRealtimeLineChart({ nodeId }: CpuUsageRealtimeLineChartProps) {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data, isLoading } = useQuery({
    queryKey: ["node-cpu", nodeId, from, to],
    queryFn: () =>
      apiClient.get<MetricDataPoint[]>(`/metrics/node/${nodeId}/cpu`, {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      formatter: (params: any) => {
        const point = params[0];
        return `${point.name}<br/>CPU: ${point.value[1].toFixed(2)}%`;
      },
    },
    xAxis: {
      type: "time",
      axisLabel: { color: "#dbdbe5" },
    },
    yAxis: {
      type: "value",
      name: "CPU Usage (%)",
      max: 100,
      axisLabel: {
        color: "#dbdbe5",
        formatter: "{value}%",
      },
    },
    series: [
      {
        type: "line",
        data: (data || []).map((d) => [d.time, d.value]),
        color: "#008dff",
        smooth: true,
        areaStyle: { opacity: 0.2 },
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={isLoading} height={300} />;
}
