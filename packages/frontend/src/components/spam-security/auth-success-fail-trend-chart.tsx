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
      textStyle: { color: "#dbdbe5" },
    },
    xAxis: {
      type: "time",
      axisLabel: { color: "#dbdbe5" },
    },
    yAxis: {
      type: "value",
      name: "Attempts",
      axisLabel: { color: "#dbdbe5" },
    },
    series: [
      {
        name: "Success",
        type: "line",
        data: (data || []).map((d) => [d.bucket, d.success]),
        color: "#51c148",
        smooth: true,
        lineStyle: { width: 2 },
      },
      {
        name: "Failed",
        type: "line",
        data: (data || []).map((d) => [d.bucket, d.fail]),
        color: "#ff5f5b",
        smooth: true,
        lineStyle: { width: 2 },
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={isLoading} height={300} />;
}
