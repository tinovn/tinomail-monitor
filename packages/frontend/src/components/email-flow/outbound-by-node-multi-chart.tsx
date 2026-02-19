import { useEffect, useState, useCallback } from "react";
import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore, getPresetRange } from "@/stores/global-time-range-store";

interface NodeThroughput {
  time: string;
  [node: string]: number | string;
}

interface NodeThroughputRow {
  time: string;
  event_type: string;
  group_value?: string;
  count: number;
}

export function OutboundByNodeMultiChart() {
  const { preset, autoRefresh } = useTimeRangeStore();
  const [data, setData] = useState<NodeThroughput[]>([]);
  const [nodes, setNodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNodeThroughput = useCallback(async () => {
    try {
      const { from, to } = getPresetRange(preset);

      const result = await apiClient.get<NodeThroughputRow[]>(
        `/email/throughput?from=${from.toISOString()}&to=${to.toISOString()}&by=node`
      );

      const { data: transformedData, nodes: nodeList } = transformNodeData(result);
      setData(transformedData);
      setNodes(nodeList);
    } catch (error) {
      console.error("Failed to fetch node throughput:", error);
    } finally {
      setLoading(false);
    }
  }, [preset]);

  useEffect(() => {
    fetchNodeThroughput();
    const interval = autoRefresh
      ? setInterval(fetchNodeThroughput, autoRefresh * 1000)
      : undefined;
    return () => { if (interval) clearInterval(interval); };
  }, [fetchNodeThroughput, autoRefresh]);

  const transformNodeData = (
    rawData: NodeThroughputRow[]
  ): { data: NodeThroughput[]; nodes: string[] } => {
    const grouped = new Map<string, NodeThroughput>();
    const nodeSet = new Set<string>();

    for (const row of rawData) {
      const time = new Date(row.time).toISOString();
      const node = row.group_value || "unknown";
      nodeSet.add(node);

      if (!grouped.has(time)) {
        grouped.set(time, { time });
      }

      const entry = grouped.get(time)!;
      entry[node] = (entry[node] as number || 0) + row.count;
    }

    return {
      data: Array.from(grouped.values()).sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
      ),
      nodes: Array.from(nodeSet),
    };
  };

  const colors = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
    "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
  ];

  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
    },
    legend: {
      data: nodes,
      textStyle: { color: "#dbdbe5" },
      type: "scroll",
    },
    xAxis: {
      type: "time",
      axisLabel: { color: "#dbdbe5" },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#dbdbe5" },
    },
    series: nodes.map((node, idx) => ({
      name: node,
      type: "line" as const,
      data: data.map((d) => [d.time, d[node] || 0]),
      smooth: true,
      lineStyle: { color: colors[idx % colors.length] },
      itemStyle: { color: colors[idx % colors.length] },
    })),
  };

  return <EchartsBaseWrapper option={option} loading={loading} height={400} />;
}
