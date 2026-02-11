import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface HeatmapData {
  hour: number;
  weekday: number;
  deliveredPercent: number;
  totalSent: number;
}

interface DestinationDeliveryHeatmapChartProps {
  data: HeatmapData[];
  loading?: boolean;
}

export function DestinationDeliveryHeatmapChart({
  data,
  loading = false,
}: DestinationDeliveryHeatmapChartProps) {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);

  // Transform data into heatmap format [hour, weekday, deliveredPercent]
  const heatmapData = data.map((item) => [
    item.hour,
    item.weekday,
    item.deliveredPercent,
  ]);

  const option: EChartsOption = {
    title: {
      text: "Best Sending Window (Hour × Weekday)",
      left: "center",
      textStyle: {
        color: "oklch(0.895 0.013 285)",
        fontSize: 14,
        fontWeight: 600,
      },
    },
    tooltip: {
      position: "top",
      backgroundColor: "oklch(0.234 0.017 285)",
      borderColor: "oklch(0.316 0.017 285)",
      textStyle: {
        color: "oklch(0.895 0.013 285)",
      },
      formatter: (params: any) => {
        const hour = hours[params.data[0]];
        const day = weekdays[params.data[1]];
        const percent = params.data[2].toFixed(1);
        return `${day} ${hour}<br/>Delivery Rate: ${percent}%`;
      },
    },
    grid: {
      left: "10%",
      right: "10%",
      top: "15%",
      bottom: "10%",
    },
    xAxis: {
      type: "category",
      data: hours,
      splitArea: {
        show: true,
      },
      axisLine: { lineStyle: { color: "oklch(0.316 0.017 285)" } },
      axisLabel: {
        color: "oklch(0.629 0.017 285)",
        fontSize: 10,
        interval: 2,
      },
    },
    yAxis: {
      type: "category",
      data: weekdays,
      splitArea: {
        show: true,
      },
      axisLine: { lineStyle: { color: "oklch(0.316 0.017 285)" } },
      axisLabel: { color: "oklch(0.629 0.017 285)" },
    },
    visualMap: {
      min: 0,
      max: 100,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: "0%",
      textStyle: {
        color: "oklch(0.629 0.017 285)",
      },
      inRange: {
        color: [
          "oklch(0.627 0.223 29)",   // Red (low)
          "oklch(0.754 0.166 83)",   // Yellow (medium)
          "oklch(0.646 0.168 154)",  // Green (high)
        ],
      },
    },
    series: [
      {
        name: "Delivery Rate",
        type: "heatmap",
        data: heatmapData,
        label: {
          show: false,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: "rgba(0, 0, 0, 0.5)",
          },
        },
      },
    ],
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <EchartsBaseWrapper option={option} loading={loading} height={400} />
    </div>
  );
}
