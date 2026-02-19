import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface VolumeTrendData {
  timestamp: string;
  delivered: number;
  bounced: number;
  total: number;
}

interface DomainVolumeTrendLineChartProps {
  data: VolumeTrendData[];
  loading?: boolean;
}

export function DomainVolumeTrendLineChart({
  data,
  loading = false,
}: DomainVolumeTrendLineChartProps) {
  const timestamps = data.map((d) =>
    new Date(d.timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })
  );
  const delivered = data.map((d) => d.delivered);
  const bounced = data.map((d) => d.bounced);

  const option: EChartsOption = {
    title: {
      text: "30-Day Volume Trend",
      left: "center",
      textStyle: {
        color: "#dbdbe5",
        fontSize: 14,
        fontWeight: 600,
      },
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1d1d26",
      borderColor: "#31313a",
      textStyle: {
        color: "#dbdbe5",
      },
      formatter: (params: any) => {
        const date = params[0].name;
        const deliveredVal = params[0].value;
        const bouncedVal = params[1].value;
        const total = deliveredVal + bouncedVal;
        return `${date}<br/>Delivered: ${deliveredVal.toLocaleString()}<br/>Bounced: ${bouncedVal.toLocaleString()}<br/>Total: ${total.toLocaleString()}`;
      },
    },
    legend: {
      data: ["Delivered", "Bounced"],
      top: 30,
      textStyle: {
        color: "#878893",
      },
    },
    xAxis: {
      type: "category",
      data: timestamps,
      axisLine: { lineStyle: { color: "#31313a" } },
      axisLabel: { color: "#878893", rotate: 45 },
    },
    yAxis: {
      type: "value",
      axisLine: { lineStyle: { color: "#31313a" } },
      axisLabel: { color: "#878893" },
      splitLine: { lineStyle: { color: "#1d1d26" } },
    },
    series: [
      {
        name: "Delivered",
        type: "line",
        data: delivered,
        smooth: true,
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(133, 255, 189, 0.3)" },
              { offset: 1, color: "rgba(133, 255, 189, 0.05)" },
            ],
          },
        },
        lineStyle: { color: "#3aa85b", width: 2 },
        itemStyle: { color: "#3aa85b" },
      },
      {
        name: "Bounced",
        type: "line",
        data: bounced,
        smooth: true,
        lineStyle: { color: "#f1372b", width: 2 },
        itemStyle: { color: "#f1372b" },
      },
    ],
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <EchartsBaseWrapper option={option} loading={loading} height={300} />
    </div>
  );
}
