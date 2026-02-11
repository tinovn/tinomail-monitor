import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface TlsVersion {
  version: string;
  count: number;
}

export function TlsVersionDistributionPieChart() {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data, isLoading } = useQuery({
    queryKey: ["security", "tls", "versions", from, to],
    queryFn: () =>
      apiClient.get<TlsVersion[]>("/security/tls/versions", {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const option: EChartsOption = {
    tooltip: {
      trigger: "item",
      formatter: "{a} <br/>{b}: {c} ({d}%)",
    },
    legend: {
      orient: "vertical",
      left: "left",
      textStyle: { color: "oklch(0.895 0.013 285)" },
    },
    series: [
      {
        name: "TLS Version",
        type: "pie",
        radius: ["40%", "70%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: "oklch(0.22 0.013 285)",
          borderWidth: 2,
        },
        label: {
          show: true,
          color: "oklch(0.895 0.013 285)",
          formatter: "{b}: {d}%",
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: "bold",
          },
        },
        data: (data || []).map((d) => ({
          name: d.version || "None",
          value: d.count,
          itemStyle: {
            color:
              d.version === "TLS 1.3"
                ? "oklch(0.72 0.19 142)"
                : d.version === "TLS 1.2"
                  ? "oklch(0.75 0.12 220)"
                  : "oklch(0.70 0.20 25)",
          },
        })),
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={isLoading} height={300} />;
}
