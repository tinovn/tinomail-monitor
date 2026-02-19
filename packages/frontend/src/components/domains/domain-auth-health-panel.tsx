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
      formatter: "{b}<br/>{a0}: {c0}%<br/>{a1}: {c1}%<br/>{a2}: {c2}%",
    },
    legend: {
      data: ["DKIM Pass %", "SPF Pass %", "DMARC Pass %"],
      top: 30,
      textStyle: {
        color: "#878893",
      },
    },
    xAxis: {
      type: "category",
      data: timestamps,
      axisLine: { lineStyle: { color: "#31313a" } },
      axisLabel: { color: "#878893" },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      axisLine: { lineStyle: { color: "#31313a" } },
      axisLabel: {
        color: "#878893",
        formatter: "{value}%",
      },
      splitLine: { lineStyle: { color: "#1d1d26" } },
    },
    series: [
      {
        name: "DKIM Pass %",
        type: "line",
        data: dkimPassRates,
        smooth: true,
        lineStyle: { color: "#3aa85b", width: 2 },
        itemStyle: { color: "#3aa85b" },
      },
      {
        name: "SPF Pass %",
        type: "line",
        data: spfPassRates,
        smooth: true,
        lineStyle: { color: "#00b3ff", width: 2 },
        itemStyle: { color: "#00b3ff" },
      },
      {
        name: "DMARC Pass %",
        type: "line",
        data: dmarcPassRates,
        smooth: true,
        lineStyle: { color: "#e2a300", width: 2 },
        itemStyle: { color: "#e2a300" },
      },
    ],
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <EchartsBaseWrapper option={option} loading={loading} height={300} />
    </div>
  );
}
