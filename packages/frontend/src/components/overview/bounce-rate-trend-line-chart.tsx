import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface BounceRateDataPoint {
  time: Date;
  bounceRate: number;
}

export function BounceRateTrendLineChart() {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data, isLoading } = useQuery({
    queryKey: ["bounce-rate-trend", from, to],
    queryFn: () =>
      apiClient.get<BounceRateDataPoint[]>("/metrics/bounce-rate", {
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
        return `${point.name}<br/>Bounce Rate: ${point.value[1].toFixed(2)}%`;
      },
    },
    xAxis: {
      type: "time",
      axisLabel: { color: "oklch(0.895 0.013 285)" },
    },
    yAxis: {
      type: "value",
      name: "Bounce Rate (%)",
      axisLabel: {
        color: "oklch(0.895 0.013 285)",
        formatter: "{value}%",
      },
    },
    series: [
      {
        type: "line",
        data: (data || []).map((d) => [d.time, d.bounceRate]),
        color: "oklch(0.70 0.20 25)",
        smooth: true,
        markLine: {
          data: [{ yAxis: 5, name: "5% Threshold" }],
          lineStyle: {
            color: "oklch(0.85 0.15 85)",
            type: "dashed",
          },
          label: {
            formatter: "Threshold: 5%",
            color: "oklch(0.895 0.013 285)",
          },
        },
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={isLoading} height={300} />;
}
