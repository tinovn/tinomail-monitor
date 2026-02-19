import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";
import { format } from "date-fns";

interface HeatmapDataPoint {
  nodeId: string;
  bucket: Date;
  value: number;
}

interface ClusterMetricsHeatmapChartProps {
  metric: string;
  bucket: string;
}

export function ClusterMetricsHeatmapChart({ metric, bucket }: ClusterMetricsHeatmapChartProps) {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data, isLoading } = useQuery({
    queryKey: ["node-heatmap", metric, bucket, from, to],
    queryFn: () =>
      apiClient.get<HeatmapDataPoint[]>("/nodes/heatmap", {
        metric,
        bucket,
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const nodes = Array.from(new Set((data || []).map((d) => d.nodeId))).sort();
  const times = Array.from(
    new Set((data || []).map((d) => new Date(d.bucket).getTime())),
  ).sort();

  const heatmapData = (data || []).map((point) => {
    const nodeIndex = nodes.indexOf(point.nodeId);
    const timeIndex = times.indexOf(new Date(point.bucket).getTime());
    return [timeIndex, nodeIndex, point.value];
  });

  const option: EChartsOption = {
    tooltip: {
      position: "top",
      formatter: (params: any) => {
        const nodeId = nodes[params.value[1]];
        const time = format(new Date(times[params.value[0]]), "MMM dd HH:mm");
        const value = params.value[2].toFixed(2);
        return `${nodeId}<br/>${time}<br/>Value: ${value}`;
      },
    },
    grid: {
      height: "70%",
      top: "10%",
    },
    xAxis: {
      type: "category",
      data: times.map((t) => format(new Date(t), "HH:mm")),
      axisLabel: {
        color: "#dbdbe5",
        rotate: 45,
      },
    },
    yAxis: {
      type: "category",
      data: nodes,
      axisLabel: { color: "#dbdbe5" },
    },
    visualMap: {
      min: 0,
      max: 100,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: "5%",
      inRange: {
        color: [
          "#51c148",
          "#fac547",
          "#ff5f5b",
        ],
      },
      textStyle: { color: "#dbdbe5" },
    },
    series: [
      {
        type: "heatmap",
        data: heatmapData,
        label: {
          show: false,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: "rgba(0, 0, 0, 0.5)",
          },
        },
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={isLoading} height={500} />;
}
