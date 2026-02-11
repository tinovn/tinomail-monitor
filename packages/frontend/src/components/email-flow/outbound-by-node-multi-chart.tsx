import { useEffect, useState } from "react";
import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface NodeThroughput {
  time: string;
  [node: string]: number | string;
}

export function OutboundByNodeMultiChart() {
  const [data, setData] = useState<NodeThroughput[]>([]);
  const [nodes, setNodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNodeThroughput();
    const interval = setInterval(fetchNodeThroughput, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNodeThroughput = async () => {
    try {
      const to = new Date();
      const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);

      const response = await fetch(
        `/api/v1/email/throughput?from=${from.toISOString()}&to=${to.toISOString()}&by=node`
      );
      const result = await response.json();

      if (result.success) {
        const { data: transformedData, nodes: nodeList } = transformNodeData(
          result.data
        );
        setData(transformedData);
        setNodes(nodeList);
      }
    } catch (error) {
      console.error("Failed to fetch node throughput:", error);
    } finally {
      setLoading(false);
    }
  };

  const transformNodeData = (
    rawData: any[]
  ): { data: NodeThroughput[]; nodes: string[] } => {
    const grouped = new Map<string, NodeThroughput>();
    const nodeSet = new Set<string>();

    for (const row of rawData) {
      const time = new Date(row.time).toISOString();
      const node = row.mta_node || "unknown";
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
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#f97316",
    "#06b6d4",
    "#84cc16",
  ];

  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
    },
    legend: {
      data: nodes,
      textStyle: { color: "oklch(0.895 0.013 285)" },
      type: "scroll",
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: data.map((d) => new Date(d.time).toLocaleTimeString()),
      axisLabel: { color: "oklch(0.895 0.013 285)" },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "oklch(0.895 0.013 285)" },
    },
    series: nodes.map((node, idx) => ({
      name: node,
      type: "line",
      data: data.map((d) => d[node] || 0),
      smooth: true,
      lineStyle: { color: colors[idx % colors.length] },
      itemStyle: { color: colors[idx % colors.length] },
    })),
  };

  return <EchartsBaseWrapper option={option} loading={loading} height={400} />;
}
