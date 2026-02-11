import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface AuthTrendDataPoint {
  bucket: string;
  success: number;
  fail: number;
}

export function AuthSuccessFailTrendChart() {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data, isLoading } = useQuery({
    queryKey: ["security", "auth", "trend", from, to],
    queryFn: () =>
      apiClient.get<AuthTrendDataPoint[]>("/security/auth/trend", {
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
      data: ["Success", "Failed"],
      textStyle: { color: "oklch(0.895 0.013 285)" },
    },
    xAxis: {
      type: "time",
      axisLabel: { color: "oklch(0.895 0.013 285)" },
    },
    yAxis: {
      type: "value",
      name: "Attempts",
      axisLabel: { color: "oklch(0.895 0.013 285)" },
    },
    series: [
      {
        name: "Success",
        type: "line",
        data: (data || []).map((d) => [d.bucket, d.success]),
        color: "oklch(0.72 0.19 142)",
        smooth: true,
        lineStyle: { width: 2 },
      },
      {
        name: "Failed",
        type: "line",
        data: (data || []).map((d) => [d.bucket, d.fail]),
        color: "oklch(0.70 0.20 25)",
        smooth: true,
        lineStyle: { width: 2 },
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={isLoading} height={300} />;
}
