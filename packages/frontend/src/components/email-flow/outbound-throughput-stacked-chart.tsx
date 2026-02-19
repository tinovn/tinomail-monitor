import { useEffect, useState, useCallback } from "react";
import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";

interface ThroughputData {
  time: string;
  delivered: number;
  bounced: number;
  deferred: number;
  rejected: number;
}

interface ThroughputRow {
  time: string;
  event_type: string;
  count: number;
}

export function OutboundThroughputStackedChart() {
  const { from, to, autoRefresh, refreshRange } = useTimeRangeStore();
  const [data, setData] = useState<ThroughputData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchThroughputData = useCallback(async () => {
    try {
      refreshRange();
      const { from: freshFrom, to: freshTo } = useTimeRangeStore.getState();

      const result = await apiClient.get<ThroughputRow[]>(
        `/email/throughput?from=${freshFrom.toISOString()}&to=${freshTo.toISOString()}`
      );

      setData(transformData(result));
    } catch (error) {
      console.error("Failed to fetch throughput data:", error);
    } finally {
      setLoading(false);
    }
  }, [refreshRange]);

  useEffect(() => {
    fetchThroughputData();
    const interval = autoRefresh
      ? setInterval(fetchThroughputData, autoRefresh * 1000)
      : undefined;
    return () => { if (interval) clearInterval(interval); };
  }, [fetchThroughputData, autoRefresh]);

  useEffect(() => {
    fetchThroughputData();
  }, [from, to, fetchThroughputData]);

  const transformData = (rawData: ThroughputRow[]): ThroughputData[] => {
    const grouped = new Map<string, ThroughputData>();

    for (const row of rawData) {
      const time = new Date(row.time).toISOString();
      if (!grouped.has(time)) {
        grouped.set(time, {
          time,
          delivered: 0,
          bounced: 0,
          deferred: 0,
          rejected: 0,
        });
      }

      const entry = grouped.get(time)!;
      if (row.event_type === "delivered") entry.delivered = row.count;
      if (row.event_type === "bounced") entry.bounced = row.count;
      if (row.event_type === "deferred") entry.deferred = row.count;
      if (row.event_type === "rejected") entry.rejected = row.count;
    }

    return Array.from(grouped.values()).sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );
  };

  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
    },
    legend: {
      data: ["Delivered", "Deferred", "Bounced", "Rejected"],
      textStyle: { color: "#dbdbe5" },
    },
    xAxis: {
      type: "time",
      axisLabel: { color: "#dbdbe5" },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#dbdbe5" },
    },
    series: [
      {
        name: "Delivered",
        type: "line",
        stack: "total",
        areaStyle: { color: "rgba(34, 197, 94, 0.3)" },
        lineStyle: { color: "#22c55e" },
        itemStyle: { color: "#22c55e" },
        data: data.map((d) => [d.time, d.delivered]),
        smooth: true,
      },
      {
        name: "Deferred",
        type: "line",
        stack: "total",
        areaStyle: { color: "rgba(234, 179, 8, 0.3)" },
        lineStyle: { color: "#eab308" },
        itemStyle: { color: "#eab308" },
        data: data.map((d) => [d.time, d.deferred]),
        smooth: true,
      },
      {
        name: "Bounced",
        type: "line",
        stack: "total",
        areaStyle: { color: "rgba(239, 68, 68, 0.3)" },
        lineStyle: { color: "#ef4444" },
        itemStyle: { color: "#ef4444" },
        data: data.map((d) => [d.time, d.bounced]),
        smooth: true,
      },
      {
        name: "Rejected",
        type: "line",
        stack: "total",
        areaStyle: { color: "rgba(249, 115, 22, 0.3)" },
        lineStyle: { color: "#f97316" },
        itemStyle: { color: "#f97316" },
        data: data.map((d) => [d.time, d.rejected]),
        smooth: true,
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={loading} height={400} />;
}
