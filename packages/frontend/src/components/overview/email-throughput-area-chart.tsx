import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface ThroughputDataPoint {
  time: Date;
  delivered: number;
  deferred: number;
  bounced: number;
}

export function EmailThroughputAreaChart() {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data, isLoading } = useQuery({
    queryKey: ["email-throughput", from, to],
    queryFn: () =>
      apiClient.get<ThroughputDataPoint[]>("/metrics/email-throughput", {
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
      data: ["Delivered", "Deferred", "Bounced"],
      textStyle: { color: "#dbdbe5" },
    },
    xAxis: {
      type: "time",
      axisLabel: { color: "#dbdbe5" },
    },
    yAxis: {
      type: "value",
      name: "Emails",
      axisLabel: { color: "#dbdbe5" },
    },
    series: [
      {
        name: "Delivered",
        type: "line",
        areaStyle: { opacity: 0.3 },
        data: (data || []).map((d) => [d.time, d.delivered]),
        color: "#51c148",
        smooth: true,
      },
      {
        name: "Deferred",
        type: "line",
        areaStyle: { opacity: 0.3 },
        data: (data || []).map((d) => [d.time, d.deferred]),
        color: "#fac547",
        smooth: true,
      },
      {
        name: "Bounced",
        type: "line",
        areaStyle: { opacity: 0.3 },
        data: (data || []).map((d) => [d.time, d.bounced]),
        color: "#ff5f5b",
        smooth: true,
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={isLoading} height={300} />;
}
