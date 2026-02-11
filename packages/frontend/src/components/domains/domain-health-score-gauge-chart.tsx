import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface DomainHealthScoreGaugeChartProps {
  score: number;
  title?: string;
  loading?: boolean;
}

export function DomainHealthScoreGaugeChart({
  score,
  title = "Domain Health Score",
  loading = false,
}: DomainHealthScoreGaugeChartProps) {
  const option: EChartsOption = {
    title: {
      text: title,
      left: "center",
      textStyle: {
        color: "oklch(0.895 0.013 285)",
        fontSize: 14,
        fontWeight: 600,
      },
    },
    series: [
      {
        type: "gauge",
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        splitNumber: 5,
        axisLine: {
          lineStyle: {
            width: 20,
            color: [
              [0.5, "oklch(0.627 0.223 29)"], // Critical (red)
              [0.7, "oklch(0.754 0.166 83)"], // Warning (yellow)
              [1, "oklch(0.646 0.168 154)"],  // OK (green)
            ],
          },
        },
        pointer: {
          length: "70%",
          width: 5,
          itemStyle: {
            color: "oklch(0.895 0.013 285)",
          },
        },
        axisTick: {
          distance: -20,
          length: 5,
          lineStyle: {
            color: "oklch(0.895 0.013 285)",
            width: 1,
          },
        },
        splitLine: {
          distance: -20,
          length: 10,
          lineStyle: {
            color: "oklch(0.895 0.013 285)",
            width: 2,
          },
        },
        axisLabel: {
          distance: 10,
          color: "oklch(0.629 0.017 285)",
          fontSize: 12,
        },
        detail: {
          valueAnimation: true,
          formatter: "{value}",
          color: "oklch(0.895 0.013 285)",
          fontSize: 32,
          fontWeight: "bold",
          offsetCenter: [0, "70%"],
        },
        data: [{ value: score }],
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={loading} height={280} />;
}
