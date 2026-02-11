import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface MongodbMetric {
  nodeId: string;
  time: string;
  opsInsert: number | null;
  opsQuery: number | null;
  opsUpdate: number | null;
  opsDelete: number | null;
  opsCommand: number | null;
}

export function OpsPerSecStackedAreaChart() {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["mongodb", "metrics", from.toISOString(), to.toISOString()],
    queryFn: () =>
      apiClient.get<MongodbMetric[]>("/metrics/mongodb", {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const chartOption: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
      },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return "";
        let result = `<div style="font-size: 11px;">${params[0].axisValue}</div>`;
        params.forEach((param: any) => {
          result += `<div style="font-size: 11px;">${param.marker} ${param.seriesName}: ${param.value[1] || 0}</div>`;
        });
        return result;
      },
    },
    legend: {
      data: ["Insert", "Query", "Update", "Delete", "Command"],
      textStyle: {
        color: "oklch(0.58 0.015 270)",
        fontSize: 10,
      },
      top: 0,
    },
    xAxis: {
      type: "time",
      axisLabel: {
        formatter: "{HH}:{mm}",
      },
    },
    yAxis: {
      type: "value",
      name: "Ops/sec",
      nameTextStyle: {
        fontSize: 10,
      },
    },
    series: buildStackedSeries(metrics || []),
  };

  return <EchartsBaseWrapper option={chartOption} loading={isLoading} height={250} />;
}

function buildStackedSeries(metrics: MongodbMetric[]): any[] {
  const opTypes = [
    { key: "opsInsert" as const, name: "Insert", color: "oklch(0.65 0.15 150)" },
    { key: "opsQuery" as const, name: "Query", color: "oklch(0.65 0.15 220)" },
    { key: "opsUpdate" as const, name: "Update", color: "oklch(0.70 0.15 80)" },
    { key: "opsDelete" as const, name: "Delete", color: "oklch(0.65 0.15 25)" },
    { key: "opsCommand" as const, name: "Command", color: "oklch(0.60 0.15 290)" },
  ];

  return opTypes.map((opType) => {
    const data = metrics
      .map((m) => [m.time, m[opType.key] || 0] as [string, number])
      .sort((a, b) => a[0].localeCompare(b[0]));

    return {
      name: opType.name,
      type: "line",
      stack: "total",
      areaStyle: {
        opacity: 0.6,
      },
      emphasis: {
        focus: "series",
      },
      data,
      smooth: true,
      symbol: "none",
      itemStyle: {
        color: opType.color,
      },
    };
  });
}
