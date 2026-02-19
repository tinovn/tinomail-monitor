import { AlertTriangle } from "lucide-react";
import type { EChartsOption } from "echarts";
import { EchartsBaseWrapper } from "@/components/charts/echarts-base-wrapper";

interface MongodbNodeStatus {
  nodeId: string;
  role: string | null;
  wtCacheUsedBytes: number | null;
  wtCacheMaxBytes: number | null;
  wtCacheDirtyBytes: number | null;
  wtCacheTimeoutCount: number | null;
}

interface WiredtigerCacheGaugeChartProps {
  nodes: MongodbNodeStatus[];
}

function getCachePressure(
  primary: MongodbNodeStatus | undefined,
): "stressed" | "elevated" | "normal" {
  if (!primary) return "normal";
  const timeoutStressed = (primary.wtCacheTimeoutCount ?? 0) > 0;
  const dirtyRatio =
    primary.wtCacheDirtyBytes !== null && primary.wtCacheMaxBytes
      ? primary.wtCacheDirtyBytes / primary.wtCacheMaxBytes
      : 0;
  if (timeoutStressed || dirtyRatio > 0.2) return "stressed";
  if (dirtyRatio > 0.1) return "elevated";
  return "normal";
}

export function WiredtigerCacheGaugeChart({ nodes }: WiredtigerCacheGaugeChartProps) {
  const primary = nodes.find((n) => n.role?.toUpperCase() === "PRIMARY");
  const pressure = getCachePressure(primary);

  const chartOption: EChartsOption = {
    tooltip: {
      formatter: (params: any) => {
        const percentage = params.value || 0;
        return `<div style="font-size: 11px;">${params.name}<br/>${percentage.toFixed(1)}%</div>`;
      },
    },
    series: nodes.map((node, index) => {
      const percentage =
        node.wtCacheUsedBytes !== null && node.wtCacheMaxBytes !== null
          ? Math.round((node.wtCacheUsedBytes / node.wtCacheMaxBytes) * 1000) / 10
          : 0;

      return {
        name: node.nodeId,
        type: "gauge",
        center: [`${(index * 33.33 + 16.66).toFixed(1)}%`, "60%"],
        radius: "60%",
        min: 0,
        max: 100,
        splitNumber: 4,
        axisLine: {
          lineStyle: {
            width: 8,
            color: [
              [0.7, "#3aa85b"],
              [0.9, "#ce9200"],
              [1, "#dc655f"],
            ],
          },
        },
        pointer: {
          itemStyle: { color: "#777a84" },
          width: 3,
          length: "60%",
        },
        axisTick: {
          distance: -8,
          length: 4,
          lineStyle: { color: "#777a84", width: 1 },
        },
        splitLine: {
          distance: -10,
          length: 8,
          lineStyle: { color: "#777a84", width: 1 },
        },
        axisLabel: {
          distance: 12,
          color: "#777a84",
          fontSize: 9,
          formatter: (value: number) => `${value}%`,
        },
        detail: {
          valueAnimation: true,
          formatter: "{value}%",
          color: "#777a84",
          fontSize: 12,
          offsetCenter: [0, "80%"],
        },
        title: {
          offsetCenter: [0, "-20%"],
          fontSize: 10,
          color: "#777a84",
        },
        data: [{ value: percentage, name: node.nodeId }],
      };
    }),
  };

  return (
    <div>
      <EchartsBaseWrapper option={chartOption} height={220} />
      <div className="mt-2 flex justify-center">
        {pressure === "stressed" && (
          <span className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-status-critical/20 text-status-critical">
            <AlertTriangle className="h-3 w-3" />
            CACHE STRESSED
          </span>
        )}
        {pressure === "elevated" && (
          <span className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-status-warning/20 text-status-warning">
            <AlertTriangle className="h-3 w-3" />
            ELEVATED PRESSURE
          </span>
        )}
        {pressure === "normal" && (
          <span className="rounded px-2 py-0.5 text-xs font-medium bg-status-ok/20 text-status-ok">
            NORMAL
          </span>
        )}
      </div>
    </div>
  );
}
