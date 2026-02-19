import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface RamDataPoint {
  time: Date;
  usedPercent: number;
  freePercent: number;
  ramUsedBytes: number | null;
}

interface RamUsageStackedAreaChartProps {
  nodeId: string;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "—";
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

export function RamUsageStackedAreaChart({ nodeId }: RamUsageStackedAreaChartProps) {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data, isLoading } = useQuery({
    queryKey: ["node-ram", nodeId, from, to],
    queryFn: () =>
      apiClient.get<RamDataPoint[]>(`/metrics/node/${nodeId}/ram`, {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  // Compute latest RAM used for subtitle display
  const latest = data?.length ? data[data.length - 1] : null;
  const latestUsedGb = latest?.ramUsedBytes ? formatBytes(latest.ramUsedBytes) : null;
  const latestPercent = latest?.usedPercent ?? null;
  // Estimate total RAM from used bytes and percentage
  const totalRamBytes =
    latest?.ramUsedBytes && latestPercent && latestPercent > 0
      ? latest.ramUsedBytes / (latestPercent / 100)
      : null;
  const totalGb = totalRamBytes ? formatBytes(totalRamBytes) : null;

  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return "";
        const time = params[0].axisValueLabel;
        let html = `<div style="font-size:11px">${time}</div>`;
        params.forEach((p: any) => {
          const idx = p.dataIndex;
          const point = data?.[idx];
          const extra =
            p.seriesName === "Used" && point?.ramUsedBytes
              ? ` (${formatBytes(point.ramUsedBytes)})`
              : "";
          html += `<div style="font-size:11px">${p.marker} ${p.seriesName}: ${p.value[1]?.toFixed(1)}%${extra}</div>`;
        });
        return html;
      },
    },
    legend: {
      data: ["Used", "Free"],
      textStyle: { color: "#dbdbe5" },
    },
    xAxis: {
      type: "time",
      axisLabel: { color: "#dbdbe5" },
    },
    yAxis: {
      type: "value",
      name: "Memory (%)",
      max: 100,
      axisLabel: {
        color: "#dbdbe5",
        formatter: "{value}%",
      },
    },
    series: [
      {
        name: "Used",
        type: "line",
        stack: "total",
        areaStyle: { opacity: 0.6 },
        data: (data || []).map((d) => [d.time, d.usedPercent]),
        color: "#ff5f5b",
        smooth: true,
      },
      {
        name: "Free",
        type: "line",
        stack: "total",
        areaStyle: { opacity: 0.6 },
        data: (data || []).map((d) => [d.time, d.freePercent]),
        color: "#51c148",
        smooth: true,
      },
    ],
  };

  return (
    <div>
      {latestUsedGb && totalGb && (
        <p className="mb-2 text-sm text-muted-foreground">
          Using <span className="font-medium text-foreground">{latestUsedGb}</span> / {totalGb}
          <span className="ml-2 text-xs">({latestPercent?.toFixed(1)}%)</span>
        </p>
      )}
      <EchartsBaseWrapper option={option} loading={isLoading} height={280} />
    </div>
  );
}
