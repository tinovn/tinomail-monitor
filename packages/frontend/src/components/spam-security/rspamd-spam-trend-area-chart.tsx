import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface RspamdTrendDataPoint {
  bucket: string;
  scanned: number;
  ham: number;
  spam: number;
  greylist: number;
  rejected: number;
}

export function RspamdSpamTrendAreaChart() {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data, isLoading } = useQuery({
    queryKey: ["spam", "rspamd", "trend", from, to],
    queryFn: () =>
      apiClient.get<RspamdTrendDataPoint[]>("/spam/rspamd/trend", {
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
      data: ["Ham", "Spam", "Greylist", "Rejected"],
      textStyle: { color: "#dbdbe5" },
    },
    xAxis: {
      type: "time",
      axisLabel: { color: "#dbdbe5" },
    },
    yAxis: {
      type: "value",
      name: "Messages",
      axisLabel: { color: "#dbdbe5" },
    },
    series: [
      {
        name: "Ham",
        type: "line",
        stack: "total",
        areaStyle: { opacity: 0.6 },
        data: (data || []).map((d) => [d.bucket, d.ham]),
        color: "#51c148",
        smooth: true,
      },
      {
        name: "Spam",
        type: "line",
        stack: "total",
        areaStyle: { opacity: 0.6 },
        data: (data || []).map((d) => [d.bucket, d.spam]),
        color: "#fac547",
        smooth: true,
      },
      {
        name: "Greylist",
        type: "line",
        stack: "total",
        areaStyle: { opacity: 0.6 },
        data: (data || []).map((d) => [d.bucket, d.greylist]),
        color: "#3dbfe2",
        smooth: true,
      },
      {
        name: "Rejected",
        type: "line",
        stack: "total",
        areaStyle: { opacity: 0.6 },
        data: (data || []).map((d) => [d.bucket, d.rejected]),
        color: "#ff5f5b",
        smooth: true,
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={isLoading} height={300} />;
}
