import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface TimelineEvent {
  time: string;
  blacklist: string;
  tier: string;
  event_type: "listed" | "delisted";
}

interface IpBlacklistTimelineChartProps {
  ip: string;
  days?: number;
}

export function IpBlacklistTimelineChart({ ip, days = 7 }: IpBlacklistTimelineChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["ip-reputation", ip, "timeline", days],
    queryFn: () =>
      apiClient.get<TimelineEvent[]>(`/ip-reputation/${ip}/timeline`, { days: String(days) }),
    refetchInterval: 60000,
  });

  // Prepare timeline data
  const timelineData = (data || []).map((event) => ({
    name: event.blacklist,
    value: [
      event.time,
      event.blacklist,
      event.event_type === "listed" ? 1 : 0,
      event.tier,
    ],
    itemStyle: {
      color: event.event_type === "listed" ? "#ff5f5b" : "#51c148",
    },
  }));

  const blacklists = Array.from(new Set((data || []).map((e) => e.blacklist))).sort();

  const option: EChartsOption = {
    tooltip: {
      trigger: "item",
      formatter: (params: any) => {
        const [time, blacklist, isListed, tier] = params.value;
        return `
          <strong>${blacklist}</strong><br/>
          Event: ${isListed ? "Listed" : "Delisted"}<br/>
          Tier: ${tier}<br/>
          Time: ${new Date(time).toLocaleString()}
        `;
      },
    },
    legend: {
      data: ["Listed", "Delisted"],
      textStyle: { color: "#dbdbe5" },
    },
    grid: {
      left: 150,
      right: 40,
      top: 60,
      bottom: 40,
    },
    xAxis: {
      type: "time",
      axisLabel: { color: "#dbdbe5" },
      splitLine: { lineStyle: { color: "#2d2d33" } },
    },
    yAxis: {
      type: "category",
      data: blacklists,
      axisLabel: {
        color: "#dbdbe5",
        fontSize: 11,
      },
      splitLine: { show: false },
    },
    series: [
      {
        name: "Events",
        type: "scatter",
        symbolSize: 14,
        data: timelineData,
      },
    ],
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">No listing/delisting events in the last {days} days</p>
      </div>
    );
  }

  return <EchartsBaseWrapper option={option} loading={isLoading} height={300} />;
}
