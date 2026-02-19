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
      textStyle: { color: "#dbdbe5" },
    },
    series: [
      {
        name: "TLS Version",
        type: "pie",
        radius: ["40%", "70%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: "#1a1a21",
          borderWidth: 2,
        },
        label: {
          show: true,
          color: "#dbdbe5",
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
                ? "#51c148"
                : d.version === "TLS 1.2"
                  ? "#3dbfe2"
                  : "#ff5f5b",
          },
        })),
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={isLoading} height={300} />;
}
