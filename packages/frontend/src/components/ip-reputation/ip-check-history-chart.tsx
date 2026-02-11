import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface CheckHistoryEntry {
  time: string;
  blacklist: string;
  tier: string;
  listed: boolean;
  response: string | null;
}

interface IpCheckHistoryChartProps {
  ip: string;
  hours?: number;
}

export function IpCheckHistoryChart({ ip, hours = 24 }: IpCheckHistoryChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["ip-reputation", ip, "checks", hours],
    queryFn: () =>
      apiClient.get<CheckHistoryEntry[]>(`/ip-reputation/${ip}/checks`, {
        hours: String(hours),
      }),
    refetchInterval: 60000,
  });

  // Group by blacklist
  const blacklistsMap = (data || []).reduce(
    (acc, entry) => {
      if (!acc[entry.blacklist]) {
        acc[entry.blacklist] = { tier: entry.tier, data: [] };
      }
      acc[entry.blacklist].data.push({
        time: entry.time,
        listed: entry.listed,
      });
      return acc;
    },
    {} as Record<string, { tier: string; data: Array<{ time: string; listed: boolean }> }>,
  );

  // Create series for critical tier blacklists
  const criticalSeries = Object.entries(blacklistsMap)
    .filter(([_, bl]) => bl.tier === "critical")
    .map(([name, bl]) => ({
      name,
      type: "line" as const,
      step: "end" as const,
      data: bl.data.map((d) => [d.time, d.listed ? 1 : 0]),
      itemStyle: { color: "oklch(0.70 0.20 25)" },
      areaStyle: { opacity: 0.2 },
    }));

  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return "";
        const timestamp = new Date(params[0].value[0]).toLocaleString();
        let content = `<strong>${timestamp}</strong><br/>`;
        params.forEach((param: any) => {
          const status = param.value[1] === 1 ? "LISTED" : "CLEAN";
          content += `${param.seriesName}: ${status}<br/>`;
        });
        return content;
      },
    },
    legend: {
      data: Object.keys(blacklistsMap).filter((name) => blacklistsMap[name].tier === "critical"),
      textStyle: { color: "oklch(0.895 0.013 285)" },
      type: "scroll",
      bottom: 0,
    },
    grid: {
      left: 60,
      right: 40,
      top: 40,
      bottom: 80,
    },
    xAxis: {
      type: "time",
      axisLabel: { color: "oklch(0.895 0.013 285)" },
      splitLine: { lineStyle: { color: "oklch(0.3 0.01 285)" } },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 1,
      axisLabel: {
        color: "oklch(0.895 0.013 285)",
        formatter: (value: number) => (value === 1 ? "Listed" : "Clean"),
      },
      splitLine: { lineStyle: { color: "oklch(0.3 0.01 285)" } },
    },
    series: criticalSeries,
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">No check history available</p>
      </div>
    );
  }

  return <EchartsBaseWrapper option={option} loading={isLoading} height={300} />;
}
