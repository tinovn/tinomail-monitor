import { useEffect, useState } from "react";
import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface TimeBucket {
  label: string;
  count: number;
}

export function DeliveryTimeHistogramChart() {
  const [data, setData] = useState<TimeBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistogramData();
    const interval = setInterval(fetchHistogramData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchHistogramData = async () => {
    try {
      // Mock data for now - replace with actual API call
      // In production, this would query email_events and bucket by delivery_time_ms
      const mockData = [
        { label: "<1s", count: 15420 },
        { label: "1-3s", count: 8250 },
        { label: "3-10s", count: 3120 },
        { label: "10-30s", count: 1850 },
        { label: "30s-1m", count: 920 },
        { label: "1-5m", count: 380 },
        { label: ">5m", count: 160 },
      ];

      setData(mockData);
    } catch (error) {
      console.error("Failed to fetch histogram data:", error);
    } finally {
      setLoading(false);
    }
  };

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
