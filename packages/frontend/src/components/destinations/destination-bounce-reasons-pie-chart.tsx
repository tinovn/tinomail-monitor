import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface BounceReasonData {
  category: string;
  count: number;
}

interface DestinationBounceReasonsPieChartProps {
  data: BounceReasonData[];
  loading?: boolean;
}

export function DestinationBounceReasonsPieChart({
  data,
  loading = false,
}: DestinationBounceReasonsPieChartProps) {
  const chartData = data.map((item) => ({
    name: item.category,
    value: item.count,
  }));

  const option: EChartsOption = {
    title: {
      text: "Bounce Reasons",
      left: "center",
      textStyle: {
        color: "oklch(0.895 0.013 285)",
        fontSize: 14,
        fontWeight: 600,
      },
    },
    tooltip: {
      trigger: "item",
      backgroundColor: "oklch(0.234 0.017 285)",
      borderColor: "oklch(0.316 0.017 285)",
      textStyle: {
        color: "oklch(0.895 0.013 285)",
      },
      formatter: "{b}: {c} ({d}%)",
    },
    legend: {
      orient: "vertical",
      right: 10,
      top: "center",
      textStyle: {
        color: "oklch(0.629 0.017 285)",
      },
    },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        center: ["35%", "55%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: "oklch(0.234 0.017 285)",
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: "bold",
            color: "oklch(0.895 0.013 285)",
          },
        },
        data: chartData,
        color: [
          "oklch(0.627 0.223 29)",   // Red
          "oklch(0.754 0.166 83)",   // Yellow
          "oklch(0.711 0.194 231)",  // Blue
          "oklch(0.646 0.168 154)",  // Green
          "oklch(0.719 0.186 328)",  // Purple
        ],
      },
    ],
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <EchartsBaseWrapper option={option} loading={loading} height={300} />
    </div>
  );
}
