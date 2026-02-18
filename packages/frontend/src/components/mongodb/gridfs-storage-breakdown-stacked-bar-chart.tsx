import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";
import { EmptyStatePlaceholder } from "@/components/shared/empty-state-placeholder";

interface GridfsStorageBreakdownProps {
  gridfsMessagesBytes: number | null;
  gridfsAttachFilesBytes: number | null;
  gridfsAttachChunksBytes: number | null;
  gridfsStorageFilesBytes: number | null;
  gridfsStorageChunksBytes: number | null;
}

interface GridfsStorageBreakdownStackedBarChartProps {
  data: GridfsStorageBreakdownProps;
}

const SEGMENTS = [
  { key: "gridfsMessagesBytes",     label: "Messages",       color: "oklch(0.62 0.18 250)" },
  { key: "gridfsAttachFilesBytes",  label: "Attach Files",   color: "oklch(0.65 0.15 150)" },
  { key: "gridfsAttachChunksBytes", label: "Attach Chunks",  color: "oklch(0.68 0.14 80)"  },
  { key: "gridfsStorageFilesBytes", label: "Storage Files",  color: "oklch(0.60 0.15 300)" },
  { key: "gridfsStorageChunksBytes",label: "Storage Chunks", color: "oklch(0.65 0.13 25)"  },
] as const;

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function GridfsStorageBreakdownStackedBarChart({
  data,
}: GridfsStorageBreakdownStackedBarChartProps) {
  const allNull = SEGMENTS.every((s) => data[s.key] === null);

  if (allNull) {
    return <EmptyStatePlaceholder message="No GridFS storage data" className="h-[220px]" />;
  }

  const chartOption: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return "";
        let html = `<div style="font-size:11px;">WildDuck Storage</div>`;
        params.forEach((p: any) => {
          html += `<div style="font-size:11px;">${p.marker}${p.seriesName}: ${formatBytes(p.value ?? 0)}</div>`;
        });
        return html;
      },
    },
    legend: {
      data: SEGMENTS.map((s) => s.label),
      textStyle: { color: "oklch(0.58 0.015 270)", fontSize: 10 },
      top: 0,
    },
    grid: { left: "3%", right: "3%", bottom: "6%", top: "15%", containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: {
        color: "oklch(0.58 0.015 270)",
        fontSize: 10,
        formatter: (val: number) => {
          if (val >= 1e9) return `${(val / 1e9).toFixed(1)}GB`;
          if (val >= 1e6) return `${(val / 1e6).toFixed(0)}MB`;
          return `${val}`;
        },
      },
    },
    yAxis: {
      type: "category",
      data: ["WildDuck Storage"],
      axisLabel: { color: "oklch(0.58 0.015 270)", fontSize: 10 },
    },
    series: SEGMENTS.map((s) => ({
      name: s.label,
      type: "bar",
      stack: "total",
      data: [data[s.key] ?? 0],
      itemStyle: { color: s.color },
      label: { show: false },
    })),
  };

  return <EchartsBaseWrapper option={chartOption} height={220} />;
}
