import { useEffect, useState } from "react";
import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface NodeQueue {
  node: string;
  count: number;
}

export function QueuePerNodeBarChart() {
  const [data, setData] = useState<NodeQueue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQueuePerNode();
    const interval = setInterval(fetchQueuePerNode, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchQueuePerNode = async () => {
    try {
      // Mock data - replace with actual ZoneMTA API call
      const mockData = [
        { node: "mta-01", count: 1240 },
        { node: "mta-02", count: 980 },
        { node: "mta-03", count: 1560 },
        { node: "mta-04", count: 720 },
        { node: "mta-05", count: 1420 },
        { node: "mta-06", count: 890 },
        { node: "mta-07", count: 1100 },
        { node: "mta-08", count: 650 },
      ];

      setData(mockData.sort((a, b) => b.count - a.count));
    } catch (error) {
      console.error("Failed to fetch queue per node:", error);
    } finally {
      setLoading(false);
    }
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
      data: data.map((d) => d.node),
      axisLabel: { color: "oklch(0.895 0.013 285)" },
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
