import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

interface SmtpResponseCodeData {
  code: string;
  count: number;
}

interface DestinationSmtpResponseCodeBarChartProps {
  data: SmtpResponseCodeData[];
}

export function DestinationSmtpResponseCodeBarChart({
  data,
}: DestinationSmtpResponseCodeBarChartProps) {
  const sortedData = [...data].sort((a, b) => b.count - a.count);
  const codes = sortedData.map((d) => d.code);
  const counts = sortedData.map((d) => d.count);

  const getColorForCode = (code: string): string => {
    const firstDigit = code.charAt(0);
    if (firstDigit === "2") return "#10b981"; // 2xx success - green
    if (firstDigit === "4") return "#f59e0b"; // 4xx temp error - yellow
    if (firstDigit === "5") return "#ef4444"; // 5xx permanent error - red
    return "#6b7280"; // other - gray
  };

  const itemColors = codes.map((code) => getColorForCode(code));

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "rgba(17, 24, 39, 0.95)",
      borderColor: "#374151",
      textStyle: { color: "#f3f4f6" },
      formatter: (params: any) => {
        const data = params[0];
        return `${data.name}<br/>Count: ${data.value.toLocaleString()}`;
      },
    },
    grid: {
      left: "15%",
      right: "5%",
      bottom: "5%",
      top: "5%",
      containLabel: true,
    },
    xAxis: {
      type: "value",
      axisLine: { lineStyle: { color: "#374151" } },
      axisLabel: { color: "#9ca3af" },
      splitLine: { lineStyle: { color: "#374151", type: "dashed" } },
    },
    yAxis: {
      type: "category",
      data: codes,
      axisLine: { lineStyle: { color: "#374151" } },
      axisLabel: { color: "#9ca3af" },
    },
    series: [
      {
        name: "SMTP Response Codes",
        type: "bar",
        data: counts.map((count, index) => ({
          value: count,
          itemStyle: { color: itemColors[index] },
        })),
        barWidth: "60%",
        label: {
          show: false,
        },
      },
    ],
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-4 text-sm font-semibold text-foreground">
        SMTP Response Codes
      </h3>
      <ReactECharts option={option} style={{ height: "300px" }} />
    </div>
  );
}
