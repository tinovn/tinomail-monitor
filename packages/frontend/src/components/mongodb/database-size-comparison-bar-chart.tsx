import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface MongodbNodeStatus {
  nodeId: string;
  role: string | null;
  dataSizeBytes: number | null;
  indexSizeBytes: number | null;
  storageSizeBytes: number | null;
}

interface DatabaseSizeComparisonBarChartProps {
  nodes: MongodbNodeStatus[];
}

export function DatabaseSizeComparisonBarChart({
  nodes,
}: DatabaseSizeComparisonBarChartProps) {
  const primaryNode = nodes.find((n) => n.role?.toUpperCase() === "PRIMARY");

  if (!primaryNode) {
    return (
      <div className="flex h-[200px] items-center justify-center text-xs text-muted-foreground">
        No PRIMARY node found
      </div>
    );
  }

  const chartOption: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return "";
        let result = `<div style="font-size: 11px;"><strong>${params[0].axisValue}</strong></div>`;
        params.forEach((param: any) => {
          result += `<div style="font-size: 11px;">${param.marker} ${param.seriesName}: ${formatBytes(param.value)}</div>`;
        });
        return result;
      },
    },
    legend: {
      data: ["Data Size", "Index Size", "Storage Size"],
      textStyle: {
        color: "oklch(0.58 0.015 270)",
        fontSize: 10,
      },
      top: 0,
    },
    xAxis: {
      type: "category",
      data: [primaryNode.nodeId],
      axisLabel: {
        fontSize: 10,
      },
    },
    yAxis: {
      type: "value",
      name: "Size (GB)",
      nameTextStyle: {
        fontSize: 10,
      },
      axisLabel: {
        formatter: (value: number) => {
          return (value / (1024 ** 3)).toFixed(1);
        },
        fontSize: 10,
      },
    },
    series: [
      {
        name: "Data Size",
        type: "bar",
        data: [primaryNode.dataSizeBytes || 0],
        itemStyle: {
          color: "oklch(0.65 0.15 150)",
        },
      },
      {
        name: "Index Size",
        type: "bar",
        data: [primaryNode.indexSizeBytes || 0],
        itemStyle: {
          color: "oklch(0.65 0.15 220)",
        },
      },
      {
        name: "Storage Size",
        type: "bar",
        data: [primaryNode.storageSizeBytes || 0],
        itemStyle: {
          color: "oklch(0.60 0.15 290)",
        },
      },
    ],
  };

  return <EchartsBaseWrapper option={chartOption} height={200} />;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
