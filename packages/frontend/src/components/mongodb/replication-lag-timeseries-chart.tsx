import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface MongodbMetric {
  nodeId: string;
  time: string;
  replLagSeconds: number | null;
}

export function ReplicationLagTimeseriesChart() {
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
      formatter: (params: any) => {
        if (!Array.isArray(params)) return "";
        let result = `<div style="font-size: 11px;">${params[0].axisValue}</div>`;
        params.forEach((param: any) => {
          result += `<div style="font-size: 11px;">${param.marker} ${param.seriesName}: ${param.value[1]?.toFixed(2) || "N/A"}s</div>`;
        });
        return result;
      },
    },
    legend: {
      data: getNodeIds(metrics || []),
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
      name: "Seconds",
      nameTextStyle: {
        fontSize: 10,
      },
    },
    series: buildSeries(metrics || []),
  };

  return <EchartsBaseWrapper option={chartOption} loading={isLoading} height={250} />;
}

function getNodeIds(metrics: MongodbMetric[]): string[] {
  const nodeIds = new Set<string>();
  metrics.forEach((m) => nodeIds.add(m.nodeId));
  return Array.from(nodeIds).sort();
}

function buildSeries(metrics: MongodbMetric[]): any[] {
  const groupedByNode = new Map<string, Array<[string, number | null]>>();

  metrics.forEach((m) => {
    if (!groupedByNode.has(m.nodeId)) {
      groupedByNode.set(m.nodeId, []);
    }
    groupedByNode.get(m.nodeId)!.push([m.time, m.replLagSeconds]);
  });

  const colors = [
    "oklch(0.65 0.15 150)",
    "oklch(0.65 0.15 220)",
    "oklch(0.60 0.15 290)",
  ];

  const series: any[] = [];
  let colorIndex = 0;

  Array.from(groupedByNode.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([nodeId, data]) => {
      series.push({
        name: nodeId,
        type: "line",
        data,
        smooth: true,
        symbol: "none",
        lineStyle: {
          width: 2,
        },
        itemStyle: {
          color: colors[colorIndex % colors.length],
        },
      });
      colorIndex++;
    });

  series.push({
    name: "Warning (10s)",
    type: "line",
    data: [],
    markLine: {
      silent: true,
      symbol: "none",
      lineStyle: {
        type: "dashed",
        color: "oklch(0.70 0.15 80)",
        width: 1,
      },
      data: [{ yAxis: 10 }],
      label: {
        show: false,
      },
    },
  });

  series.push({
    name: "Critical (30s)",
    type: "line",
    data: [],
    markLine: {
      silent: true,
      symbol: "none",
      lineStyle: {
        type: "dashed",
        color: "oklch(0.65 0.15 25)",
        width: 1,
      },
      data: [{ yAxis: 30 }],
      label: {
        show: false,
      },
    },
  });

  return series;
}
