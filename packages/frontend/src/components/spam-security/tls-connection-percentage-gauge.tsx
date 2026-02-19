import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface TlsSummary {
  totalConnections: number;
  tlsConnections: number;
  tlsPercent: number;
}

export function TlsConnectionPercentageGauge() {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data, isLoading } = useQuery({
    queryKey: ["security", "tls", "summary", from, to],
    queryFn: () =>
      apiClient.get<TlsSummary>("/security/tls/summary", {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const percent = data?.tlsPercent || 0;
  const color =
    percent >= 90
      ? "#51c148"
      : percent >= 70
        ? "#fac547"
        : "#ff5f5b";

  const option: EChartsOption = {
    series: [
      {
        type: "gauge",
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        radius: "90%",
        center: ["50%", "70%"],
        axisLine: {
          lineStyle: {
            width: 20,
            color: [
              [0.7, "#ff5f5b"],
              [0.9, "#fac547"],
              [1, "#51c148"],
            ],
          },
        },
        pointer: {
          itemStyle: {
            color: "#dbdbe5",
          },
        },
        axisTick: {
          distance: -20,
          length: 6,
          lineStyle: {
            color: "#dbdbe5",
            width: 1,
          },
        },
        splitLine: {
          distance: -20,
          length: 20,
          lineStyle: {
            color: "#dbdbe5",
            width: 2,
          },
        },
        axisLabel: {
          color: "#dbdbe5",
          distance: 25,
          fontSize: 12,
          formatter: (value: number) => `${value}%`,
        },
        detail: {
          valueAnimation: true,
          formatter: (value: number) => `${value.toFixed(1)}%`,
          color,
          fontSize: 32,
          offsetCenter: [0, "10%"],
        },
        data: [{ value: percent }],
      },
    ],
  };

  return (
    <div>
      <EchartsBaseWrapper option={option} loading={isLoading} height={280} />
      {data && (
        <div className="mt-2 text-center text-sm text-muted-foreground">
          {data.tlsConnections.toLocaleString()} / {data.totalConnections.toLocaleString()}{" "}
          connections using TLS
        </div>
      )}
    </div>
  );
}
