import { useEffect, useState } from "react";
import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface DeferredReason {
  reason: string;
  count: number;
  percentage: number;
}

export function DeferredReasonsPieChart() {
  const [data, setData] = useState<DeferredReason[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeferredReasons();
    const interval = setInterval(fetchDeferredReasons, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchDeferredReasons = async () => {
    try {
      const to = new Date();
      const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);

      const response = await fetch(
        `/api/v1/email/bounce-analysis?from=${from.toISOString()}&to=${to.toISOString()}`
      );
      const result = await response.json();

      if (result.success) {
        const deferredData = result.data
          .filter((item: any) => item.bounceType === "deferred")
          .map((item: any) => ({
            reason: item.bounceCategory || "Unknown",
            count: item.count,
            percentage: item.percentage,
          }));

        setData(deferredData);
      }
    } catch (error) {
      console.error("Failed to fetch deferred reasons:", error);
      // Mock data fallback
      setData([
        { reason: "Rate Limited", count: 1240, percentage: 42 },
        { reason: "MX Unavailable", count: 890, percentage: 30 },
        { reason: "Timeout", count: 520, percentage: 18 },
        { reason: "Policy Block", count: 295, percentage: 10 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const option: EChartsOption = {
    tooltip: {
      trigger: "item",
      formatter: "{a} <br/>{b}: {c} ({d}%)",
    },
    legend: {
      orient: "vertical",
      left: "left",
      textStyle: { color: "#dbdbe5" },
    },
    series: [
      {
        name: "Deferred Reasons",
        type: "pie",
        radius: ["40%", "70%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: "#1a1a1a",
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: "{b}: {d}%",
          color: "#dbdbe5",
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: "bold",
          },
        },
        data: data.map((item, idx) => ({
          value: item.count,
          name: item.reason,
          itemStyle: {
            color: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"][idx % 4],
          },
        })),
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={loading} height={400} />;
}
