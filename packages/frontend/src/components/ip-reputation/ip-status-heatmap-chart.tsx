import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { apiClient } from "@/lib/api-http-client";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface IpHeatmapData {
  ip: string;
  node_id: string | null;
  subnet: string | null;
  status: string;
  blacklist_count: number;
  health_status: "clean" | "warning" | "critical" | "inactive";
}

export function IpStatusHeatmapChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["ip-reputation", "heatmap"],
    queryFn: () => apiClient.get<IpHeatmapData[]>("/ip-reputation/heatmap"),
    refetchInterval: 60000,
  });

  // Group IPs by subnet
  const groupedBySubnet = (data || []).reduce(
    (acc, ip) => {
      const subnet = ip.subnet || "Ungrouped";
      if (!acc[subnet]) acc[subnet] = [];
      acc[subnet].push(ip);
      return acc;
    },
    {} as Record<string, IpHeatmapData[]>,
  );

  const subnets = Object.keys(groupedBySubnet).sort();
  const maxIpsPerSubnet = Math.max(...Object.values(groupedBySubnet).map((ips) => ips.length), 1);

  // Prepare scatter data
  const scatterData = subnets.flatMap((subnet, subnetIdx) =>
    groupedBySubnet[subnet].map((ip, ipIdx) => {
      const colorMap = {
        clean: "oklch(0.72 0.19 142)", // green
        warning: "oklch(0.85 0.15 85)", // yellow
        critical: "oklch(0.70 0.20 25)", // red
        inactive: "oklch(0.5 0.01 285)", // gray
      };
      return {
        value: [subnetIdx, ipIdx, ip.blacklist_count],
        itemStyle: { color: colorMap[ip.health_status] },
        ip: ip.ip,
        status: ip.health_status,
        blacklistCount: ip.blacklist_count,
      };
    }),
  );

  const option: EChartsOption = {
    tooltip: {
      trigger: "item",
      formatter: (params: any) => {
        const data = params.data;
        return `
          <strong>${data.ip}</strong><br/>
          Status: ${data.status}<br/>
          Blacklists: ${data.blacklistCount}
        `;
      },
    },
    legend: {
      data: ["Clean", "Warning", "Critical", "Inactive"],
      textStyle: { color: "oklch(0.895 0.013 285)" },
      bottom: 10,
    },
    grid: {
      left: 120,
      right: 20,
      top: 20,
      bottom: 60,
    },
    xAxis: {
      type: "category",
      data: subnets,
      axisLabel: {
        color: "oklch(0.895 0.013 285)",
        rotate: 45,
        fontSize: 10,
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      max: maxIpsPerSubnet,
      axisLabel: {
        color: "oklch(0.895 0.013 285)",
        formatter: (value: number) => `IP ${value + 1}`,
      },
      splitLine: { lineStyle: { color: "oklch(0.3 0.01 285)" } },
    },
    series: [
      {
        name: "Clean",
        type: "scatter",
        symbolSize: 16,
        data: scatterData.filter((d) => d.status === "clean"),
        itemStyle: { color: "oklch(0.72 0.19 142)" },
      },
      {
        name: "Warning",
        type: "scatter",
        symbolSize: 16,
        data: scatterData.filter((d) => d.status === "warning"),
        itemStyle: { color: "oklch(0.85 0.15 85)" },
      },
      {
        name: "Critical",
        type: "scatter",
        symbolSize: 16,
        data: scatterData.filter((d) => d.status === "critical"),
        itemStyle: { color: "oklch(0.70 0.20 25)" },
      },
      {
        name: "Inactive",
        type: "scatter",
        symbolSize: 12,
        data: scatterData.filter((d) => d.status === "inactive"),
        itemStyle: { color: "oklch(0.5 0.01 285)" },
      },
    ],
  };

  return <EchartsBaseWrapper option={option} loading={isLoading} height={400} />;
}
