import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface AuthHealthData {
  timestamp: string;
  dkimPass: number;
  spfPass: number;
  dmarcPass: number;
  total: number;
}

interface DomainAuthHealthPanelProps {
  data: AuthHealthData[];
  loading?: boolean;
}

export function DomainAuthHealthPanel({
  data,
  loading = false,
}: DomainAuthHealthPanelProps) {
  const timestamps = data.map((d) => new Date(d.timestamp).toLocaleTimeString());
  const dkimPassRates = data.map((d) =>
    d.total > 0 ? ((d.dkimPass / d.total) * 100).toFixed(1) : 0
  );
  const spfPassRates = data.map((d) =>
    d.total > 0 ? ((d.spfPass / d.total) * 100).toFixed(1) : 0
  );
  const dmarcPassRates = data.map((d) =>
    d.total > 0 ? ((d.dmarcPass / d.total) * 100).toFixed(1) : 0
  );

  const option: EChartsOption = {
    title: {
      text: "Authentication Health (Pass Rates)",
      left: "center",
      textStyle: {
        color: "oklch(0.895 0.013 285)",
        fontSize: 14,
        fontWeight: 600,
      },
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "oklch(0.234 0.017 285)",
      borderColor: "oklch(0.316 0.017 285)",
      textStyle: {
        color: "oklch(0.895 0.013 285)",
      },
      formatter: "{b}<br/>{a0}: {c0}%<br/>{a1}: {c1}%<br/>{a2}: {c2}%",
    },
    legend: {
      data: ["DKIM Pass %", "SPF Pass %", "DMARC Pass %"],
      top: 30,
      textStyle: {
        color: "oklch(0.629 0.017 285)",
      },
    },
    xAxis: {
      type: "category",
      data: timestamps,
      axisLine: { lineStyle: { color: "oklch(0.316 0.017 285)" } },
      axisLabel: { color: "oklch(0.629 0.017 285)" },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      axisLine: { lineStyle: { color: "oklch(0.316 0.017 285)" } },
      axisLabel: {
        color: "oklch(0.629 0.017 285)",
        formatter: "{value}%",
      },
      splitLine: { lineStyle: { color: "oklch(0.234 0.017 285)" } },
    },
    series: [
      {
        name: "DKIM Pass %",
        type: "line",
        data: dkimPassRates,
        smooth: true,
        lineStyle: { color: "oklch(0.646 0.168 154)", width: 2 },
        itemStyle: { color: "oklch(0.646 0.168 154)" },
      },
      {
        name: "SPF Pass %",
        type: "line",
        data: spfPassRates,
        smooth: true,
        lineStyle: { color: "oklch(0.711 0.194 231)", width: 2 },
        itemStyle: { color: "oklch(0.711 0.194 231)" },
      },
      {
        name: "DMARC Pass %",
        type: "line",
        data: dmarcPassRates,
        smooth: true,
        lineStyle: { color: "oklch(0.754 0.166 83)", width: 2 },
        itemStyle: { color: "oklch(0.754 0.166 83)" },
      },
    ],
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <EchartsBaseWrapper option={option} loading={loading} height={300} />
    </div>
  );
}
