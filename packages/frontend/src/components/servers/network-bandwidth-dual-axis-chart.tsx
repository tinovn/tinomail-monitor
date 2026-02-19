import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface NetworkDataPoint {
  time: Date;
  rxBytesPerSec: number;
  txBytesPerSec: number;
}

interface NetworkBandwidthDualAxisChartProps {
  nodeId: string;
}

export function NetworkBandwidthDualAxisChart({ nodeId }: NetworkBandwidthDualAxisChartProps) {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data, isLoading } = useQuery({
    queryKey: ["node-network", nodeId, from, to],
    queryFn: () =>
      apiClient.get<NetworkDataPoint[]>(`/metrics/node/${nodeId}/network`, {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      formatter: (params: any) => {
        const rx = params[0];
        const tx = params[1];
        return `${rx.name}<br/>RX: ${formatBytes(rx.value[1])}<br/>TX: ${formatBytes(tx.value[1])}`;
      },
    },
    legend: {
      data: ["RX (Download)", "TX (Upload)"],
      textStyle: { color: "#dbdbe5" },
    },
    xAxis: {
      type: "time",
      axisLabel: { color: "#dbdbe5" },
    },
    yAxis: {
      type: "value",
      name: "Bandwidth",
      axisLabel: {
        color: "#dbdbe5",
        formatter: (value: number) => formatBytes(value),
      },
    },
    series: [
      {
        name: "RX (Download)",
        type: "line",
        data: (data || []).map((d) => [d.time, d.rxBytesPerSec]),
        color: "#51c148",
        smooth: true,
        areaStyle: { opacity: 0.3 },
      },
      {
        name: "TX (Upload)",
        type: "line",
        data: (data || []).map((d) => [d.time, d.txBytesPerSec]),
        color: "#008dff",
        smooth: true,
        areaStyle: { opacity: 0.3 },
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={isLoading} height={300} />;
}
