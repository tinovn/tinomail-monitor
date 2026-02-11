import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface MongodbNodeStatus {
  nodeId: string;
  wtCacheUsedBytes: number | null;
  wtCacheMaxBytes: number | null;
}

interface WiredtigerCacheGaugeChartProps {
  nodes: MongodbNodeStatus[];
}

export function WiredtigerCacheGaugeChart({
  nodes,
}: WiredtigerCacheGaugeChartProps) {
  const chartOption: EChartsOption = {
    tooltip: {
      formatter: (params: any) => {
        const percentage = params.value || 0;
        return `<div style="font-size: 11px;">${params.name}<br/>${percentage.toFixed(1)}%</div>`;
      },
    },
    series: nodes.map((node, index) => {
      const percentage =
        node.wtCacheUsedBytes !== null && node.wtCacheMaxBytes !== null
          ? Math.round((node.wtCacheUsedBytes / node.wtCacheMaxBytes) * 1000) / 10
          : 0;

      return {
        name: node.nodeId,
        type: "gauge",
        center: [`${(index * 33.33 + 16.66).toFixed(1)}%`, "60%"],
        radius: "60%",
        min: 0,
        max: 100,
        splitNumber: 4,
        axisLine: {
          lineStyle: {
            width: 8,
            color: [
              [0.7, "oklch(0.65 0.15 150)"],
              [0.9, "oklch(0.70 0.15 80)"],
              [1, "oklch(0.65 0.15 25)"],
            ],
          },
        },
        pointer: {
          itemStyle: {
            color: "oklch(0.58 0.015 270)",
          },
          width: 3,
          length: "60%",
        },
        axisTick: {
          distance: -8,
          length: 4,
          lineStyle: {
            color: "oklch(0.58 0.015 270)",
            width: 1,
          },
        },
        splitLine: {
          distance: -10,
          length: 8,
          lineStyle: {
            color: "oklch(0.58 0.015 270)",
            width: 1,
          },
        },
        axisLabel: {
          distance: 12,
          color: "oklch(0.58 0.015 270)",
          fontSize: 9,
          formatter: (value: number) => `${value}%`,
        },
        detail: {
          valueAnimation: true,
          formatter: "{value}%",
          color: "oklch(0.58 0.015 270)",
          fontSize: 12,
          offsetCenter: [0, "80%"],
        },
        title: {
          offsetCenter: [0, "-20%"],
          fontSize: 10,
          color: "oklch(0.58 0.015 270)",
        },
        data: [
          {
            value: percentage,
            name: node.nodeId,
          },
        ],
      };
    }),
  };

  return <EchartsBaseWrapper option={chartOption} height={220} />;
}
