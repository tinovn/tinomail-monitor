import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";
import { EmptyStatePlaceholder } from "@/components/shared/empty-state-placeholder";

interface ConnectionSourceBreakdownProps {
  connAppImap: number | null;
  connAppSmtp: number | null;
  connAppInternal: number | null;
  connAppMonitoring: number | null;
  connAppOther: number | null;
}

interface ConnectionSourceBreakdownPieChartProps {
  data: ConnectionSourceBreakdownProps;
}

const SEGMENTS = [
  { key: "connAppImap",       label: "IMAP",       color: "#0089ed" },
  { key: "connAppSmtp",       label: "SMTP",       color: "#3aa85b" },
  { key: "connAppInternal",   label: "Internal",   color: "#6f7178" },
  { key: "connAppMonitoring", label: "Monitoring", color: "#8f68cb" },
  { key: "connAppOther",      label: "Other",      color: "#c58d04"  },
] as const;

export function ConnectionSourceBreakdownPieChart({ data }: ConnectionSourceBreakdownPieChartProps) {
  const allNull = SEGMENTS.every((s) => data[s.key] === null);

  if (allNull) {
    return <EmptyStatePlaceholder message="No connection breakdown data" className="h-55" />;
  }

  const segments = SEGMENTS.map((s) => ({
    name: s.label,
    value: data[s.key] ?? 0,
    itemStyle: { color: s.color },
  }));

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  const chartOption: EChartsOption = {
    tooltip: {
      trigger: "item",
      formatter: (params: any) =>
        `<div style="font-size:11px;">${params.name}<br/>${params.value} (${params.percent}%)</div>`,
    },
    legend: {
      orient: "vertical",
      right: "5%",
      top: "center",
      textStyle: { color: "#777a84", fontSize: 10 },
    },
    graphic: [
      {
        type: "text",
        left: "22%",
        top: "center",
        style: {
          text: String(total),
          fill: "#cbced4",
          fontSize: 16,
          fontWeight: "bold",
        } as any,
      },
      {
        type: "text",
        left: "24%",
        top: "58%",
        style: {
          text: "total",
          fill: "#777a84",
          fontSize: 9,
        } as any,
      },
    ],
    series: [
      {
        type: "pie",
        radius: ["40%", "65%"],
        center: ["30%", "50%"],
        data: segments,
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 6, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.4)" },
        },
      },
    ],
  };

  return <EchartsBaseWrapper option={chartOption} height={220} />;
}
