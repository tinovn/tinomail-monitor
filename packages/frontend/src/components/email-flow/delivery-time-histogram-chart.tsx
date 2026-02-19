import { useEffect, useState, useCallback } from "react";
import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";
import { useTimeRangeStore } from "@/stores/global-time-range-store";

interface TimeBucket {
  label: string;
  count: number;
}

const EMPTY_BUCKETS: TimeBucket[] = [
  { label: "<1s", count: 0 },
  { label: "1-3s", count: 0 },
  { label: "3-10s", count: 0 },
  { label: "10-30s", count: 0 },
  { label: "30s-1m", count: 0 },
  { label: "1-5m", count: 0 },
  { label: ">5m", count: 0 },
];

export function DeliveryTimeHistogramChart() {
  const { from, to, autoRefresh, refreshRange } = useTimeRangeStore();
  const [data, setData] = useState<TimeBucket[]>(EMPTY_BUCKETS);
  const [loading, setLoading] = useState(true);

  const fetchHistogramData = useCallback(async () => {
    try {
      refreshRange();
      const { from: freshFrom, to: freshTo } = useTimeRangeStore.getState();

      const response = await fetch(
        `/api/v1/email/delivery-histogram?from=${freshFrom.toISOString()}&to=${freshTo.toISOString()}`
      );
      const result = await response.json();

      if (result.success && result.data?.length > 0) {
        setData(result.data.map((r: any) => ({ label: r.bucket, count: r.count })));
      } else {
        setData(EMPTY_BUCKETS);
      }
    } catch {
      // API may not exist yet — show empty buckets
      setData(EMPTY_BUCKETS);
    } finally {
      setLoading(false);
    }
  }, [refreshRange]);

  useEffect(() => {
    fetchHistogramData();
    const interval = autoRefresh
      ? setInterval(fetchHistogramData, autoRefresh * 1000)
      : undefined;
    return () => { if (interval) clearInterval(interval); };
  }, [fetchHistogramData, autoRefresh]);

  useEffect(() => {
    fetchHistogramData();
  }, [from, to, fetchHistogramData]);

  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    xAxis: {
      type: "category",
      data: data.map((d) => d.label),
      axisLabel: { color: "#dbdbe5" },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#dbdbe5" },
    },
    series: [
      {
        name: "Emails",
        type: "bar",
        data: data.map((d) => ({
          value: d.count,
          itemStyle: {
            color:
              d.label === "<1s" || d.label === "1-3s"
                ? "#22c55e"
                : d.label === "3-10s"
                ? "#eab308"
                : "#ef4444",
          },
        })),
        barWidth: "60%",
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={loading} height={350} />;
}
