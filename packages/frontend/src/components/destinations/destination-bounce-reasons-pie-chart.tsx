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
        color: "#dbdbe5",
        fontSize: 14,
        fontWeight: 600,
      },
    },
    tooltip: {
      trigger: "item",
      backgroundColor: "#1d1d26",
      borderColor: "#31313a",
      textStyle: {
        color: "#dbdbe5",
      },
      formatter: "{b}: {c} ({d}%)",
    },
    legend: {
      orient: "vertical",
      right: 10,
      top: "center",
      textStyle: {
        color: "#878893",
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
          borderColor: "#1d1d26",
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
            color: "#dbdbe5",
          },
        },
        data: chartData,
        color: [
          "#f1372b",   // Red
          "#e2a300",   // Yellow
          "#00b3ff",  // Blue
          "#3aa85b",  // Green
          "#e074de",  // Purple
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
