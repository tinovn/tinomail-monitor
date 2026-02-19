import { useEffect, useState } from "react";
import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface DeliveryMetrics {
  avg: number;
  p95: number;
  p99: number;
}

export function DeliveryTimeGaugeSet() {
  const [metrics, setMetrics] = useState<DeliveryMetrics>({
    avg: 0,
    p95: 0,
    p99: 0,
  });

  useEffect(() => {
    fetchDeliveryMetrics();
    const interval = setInterval(fetchDeliveryMetrics, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchDeliveryMetrics = async () => {
    try {
      const to = new Date();
      const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);

      const response = await fetch(
        `/api/v1/email/stats?from=${from.toISOString()}&to=${to.toISOString()}&groupBy=event_type`
      );
      const result = await response.json();

      if (result.success) {
        const deliveredStats = result.data.find(
          (item: any) => item.group === "delivered"
        );

        if (deliveredStats) {
          setMetrics({
            avg: deliveredStats.avgDeliveryTime || 0,
            p95: deliveredStats.p95 || 0,
            p99: deliveredStats.p99 || 0,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch delivery metrics:", error);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <DeliveryGauge label="Average" value={metrics.avg} max={10000} />
      <DeliveryGauge label="P95" value={metrics.p95} max={10000} />
      <DeliveryGauge label="P99" value={metrics.p99} max={15000} />
    </div>
  );
}

interface DeliveryGaugeProps {
  label: string;
  value: number;
  max: number;
}

function DeliveryGauge({ label, value, max }: DeliveryGaugeProps) {
  const valueInSeconds = value / 1000;

  const getColor = () => {
    if (valueInSeconds < 3) return "#22c55e";
    if (valueInSeconds < 10) return "#eab308";
    return "#ef4444";
  };

  const option: EChartsOption = {
    series: [
      {
        type: "gauge",
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max,
        splitNumber: 5,
        axisLine: {
          lineStyle: {
            width: 20,
            color: [
              [0.3, "#22c55e"],
              [0.7, "#eab308"],
              [1, "#ef4444"],
            ],
          },
        },
        pointer: {
          itemStyle: { color: "auto" },
        },
        axisTick: { show: false },
        splitLine: {
          length: 15,
          lineStyle: { width: 2, color: "#999" },
        },
        axisLabel: {
          distance: 25,
          color: "#dbdbe5",
          fontSize: 12,
          formatter: (value: number) => `${(value / 1000).toFixed(0)}s`,
        },
        detail: {
          valueAnimation: true,
          formatter: `{value}ms\n${label}`,
          color: getColor(),
          fontSize: 16,
          offsetCenter: [0, "70%"],
        },
        data: [{ value: Math.round(value) }],
      },
    ],
  };

  return <EchartsBaseWrapper option={option} height={250} />;
}
