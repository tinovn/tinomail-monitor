import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface RspamdAction {
  action: string;
  count: number;
}

export function RspamdActionBreakdownBarChart() {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data, isLoading } = useQuery({
    queryKey: ["spam", "rspamd", "actions", from, to],
    queryFn: () =>
      apiClient.get<RspamdAction[]>("/spam/rspamd/actions", {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const actionColors: Record<string, string> = {
    "no action": "#51c148",
    "add header": "#fac547",
    greylist: "#3dbfe2",
    reject: "#ff5f5b",
  };

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
      data: (data || []).map((d) => d.action),
      axisLabel: { color: "#dbdbe5" },
    },
    series: [
      {
        name: "Count",
        type: "bar",
        data: (data || []).map((d) => ({
          value: d.count,
          itemStyle: {
            color: actionColors[d.action.toLowerCase()] || "#3dbfe2",
          },
        })),
        label: {
          show: true,
          position: "right",
          color: "#dbdbe5",
          formatter: (params: any) => params.value.toLocaleString(),
        },
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={isLoading} height={250} />;
}
