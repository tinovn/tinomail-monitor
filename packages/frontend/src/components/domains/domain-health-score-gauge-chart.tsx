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
        color: "#dbdbe5",
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
              [0.5, "#f1372b"], // Critical (red)
              [0.7, "#e2a300"], // Warning (yellow)
              [1, "#3aa85b"],  // OK (green)
            ],
          },
        },
        pointer: {
          length: "70%",
          width: 5,
          itemStyle: {
            color: "#dbdbe5",
          },
        },
        axisTick: {
          distance: -20,
          length: 5,
          lineStyle: {
            color: "#dbdbe5",
            width: 1,
          },
        },
        splitLine: {
          distance: -20,
          length: 10,
          lineStyle: {
            color: "#dbdbe5",
            width: 2,
          },
        },
        axisLabel: {
          distance: 10,
          color: "#878893",
          fontSize: 12,
        },
        detail: {
          valueAnimation: true,
          formatter: "{value}",
          color: "#dbdbe5",
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
