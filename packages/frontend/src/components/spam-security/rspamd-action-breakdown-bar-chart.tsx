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
    "no action": "oklch(0.72 0.19 142)",
    "add header": "oklch(0.85 0.15 85)",
    greylist: "oklch(0.75 0.12 220)",
    reject: "oklch(0.70 0.20 25)",
  };

  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    xAxis: {
      type: "value",
      axisLabel: { color: "oklch(0.895 0.013 285)" },
    },
    yAxis: {
      type: "category",
      data: (data || []).map((d) => d.action),
      axisLabel: { color: "oklch(0.895 0.013 285)" },
    },
    series: [
      {
        name: "Count",
        type: "bar",
        data: (data || []).map((d) => ({
          value: d.count,
          itemStyle: {
            color: actionColors[d.action.toLowerCase()] || "oklch(0.75 0.12 220)",
          },
        })),
        label: {
          show: true,
          position: "right",
          color: "oklch(0.895 0.013 285)",
          formatter: (params: any) => params.value.toLocaleString(),
        },
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={isLoading} height={250} />;
}
