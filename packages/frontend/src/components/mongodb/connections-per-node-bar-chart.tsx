import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface MongodbNodeStatus {
  nodeId: string;
  connectionsCurrent: number | null;
  connectionsAvailable: number | null;
}

interface ConnectionsPerNodeBarChartProps {
  nodes: MongodbNodeStatus[];
}

export function ConnectionsPerNodeBarChart({
  nodes,
}: ConnectionsPerNodeBarChartProps) {
  const chartOption: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return "";
        const current = params[0]?.value || 0;
        const available = params[1]?.value || 0;
        const total = current + available;
        return `
          <div style="font-size: 11px;">
            <div><strong>${params[0].axisValue}</strong></div>
            <div>${params[0].marker} Current: ${current}</div>
            <div>${params[1].marker} Available: ${available}</div>
            <div>Total: ${total}</div>
          </div>
        `;
      },
    },
    legend: {
      data: ["Current", "Available"],
      textStyle: {
        color: "oklch(0.58 0.015 270)",
        fontSize: 10,
      },
      top: 0,
    },
    xAxis: {
      type: "value",
      name: "Connections",
      nameTextStyle: {
        fontSize: 10,
      },
    },
    yAxis: {
      type: "category",
      data: nodes.map((n) => n.nodeId),
      axisLabel: {
        fontSize: 10,
      },
    },
    series: [
      {
        name: "Current",
        type: "bar",
        stack: "total",
        data: nodes.map((n) => n.connectionsCurrent || 0),
        itemStyle: {
          color: "oklch(0.65 0.15 220)",
        },
        emphasis: {
          focus: "series",
        },
      },
      {
        name: "Available",
        type: "bar",
        stack: "total",
        data: nodes.map((n) => n.connectionsAvailable || 0),
        itemStyle: {
          color: "oklch(0.30 0.015 270)",
        },
        emphasis: {
          focus: "series",
        },
      },
    ],
  };

  return <EchartsBaseWrapper option={chartOption} height={200} />;
}
