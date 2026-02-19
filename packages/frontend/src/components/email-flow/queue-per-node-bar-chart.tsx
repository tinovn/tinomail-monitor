import { useEffect, useState, useCallback } from "react";
import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { apiClient } from "@/lib/api-http-client";

interface NodeQueue {
  node: string;
  count: number;
}

export function QueuePerNodeBarChart() {
  const { autoRefresh } = useTimeRangeStore();
  const [data, setData] = useState<NodeQueue[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueuePerNode = useCallback(async () => {
    try {
      // Queue size is point-in-time from latest ZoneMTA metrics
      const result = await apiClient.get<Array<{ nodeId: string; queueSize: number }>>(
        "/zonemta/queue-per-node"
      );

      if (result && result.length > 0) {
        setData(
          result
            .map((r) => ({ node: r.nodeId, count: r.queueSize }))
            .sort((a, b) => b.count - a.count)
        );
      }
    } catch {
      // API may not exist yet — show empty
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueuePerNode();
    const interval = autoRefresh
      ? setInterval(fetchQueuePerNode, autoRefresh * 1000)
      : undefined;
    return () => { if (interval) clearInterval(interval); };
  }, [fetchQueuePerNode, autoRefresh]);

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
      data: data.map((d) => d.node),
      axisLabel: { color: "#dbdbe5" },
    },
    series: [
      {
        name: "Queue Size",
        type: "bar",
        data: data.map((d) => ({
          value: d.count,
          itemStyle: {
            color: d.count > 1200 ? "#ef4444" : d.count > 800 ? "#eab308" : "#22c55e",
          },
        })),
        barWidth: "70%",
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={loading} height={350} />;
}
