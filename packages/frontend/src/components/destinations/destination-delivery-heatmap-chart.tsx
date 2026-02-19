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
        color: "#dbdbe5",
        fontSize: 14,
        fontWeight: 600,
      },
    },
    tooltip: {
      position: "top",
      backgroundColor: "#1d1d26",
      borderColor: "#31313a",
      textStyle: {
        color: "#dbdbe5",
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
      axisLine: { lineStyle: { color: "#31313a" } },
      axisLabel: {
        color: "#878893",
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
      axisLine: { lineStyle: { color: "#31313a" } },
      axisLabel: { color: "#878893" },
    },
    visualMap: {
      min: 0,
      max: 100,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: "0%",
      textStyle: {
        color: "#878893",
      },
      inRange: {
        color: [
          "#f1372b",   // Red (low)
          "#e2a300",   // Yellow (medium)
          "#3aa85b",  // Green (high)
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
