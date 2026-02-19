import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface DomainStat {
  domain: string;
  count: number;
}

export function TopSendingDomainsHorizontalBarChart() {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data, isLoading } = useQuery({
    queryKey: ["top-domains", from, to],
    queryFn: () =>
      apiClient.get<DomainStat[]>("/metrics/top-domains", {
        from: from.toISOString(),
        to: to.toISOString(),
        limit: 10,
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    xAxis: {
      type: "value",
      axisLabel: { color: "#dbdbe5" },
    },
    yAxis: {
      type: "category",
      data: (data || []).map((d) => d.domain).reverse(),
      axisLabel: { color: "#dbdbe5" },
    },
    series: [
      {
        type: "bar",
        data: (data || []).map((d) => d.count).reverse(),
        color: "#008dff",
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
        },
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={isLoading} height={300} />;
}
