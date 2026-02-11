import { useRef, useEffect } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

interface SparklineMiniChartProps {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
  variant?: "table-cell" | "standalone";
}

export function SparklineMiniChart({
  data,
  color = "oklch(0.623 0.214 259)",
  height,
  className,
  variant = "standalone",
}: SparklineMiniChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  const chartHeight = height ?? (variant === "table-cell" ? 28 : 40);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current);
    }

    const option: EChartsOption = {
      grid: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      },
      xAxis: {
        type: "category",
        show: false,
        data: data.map((_, i) => i),
      },
      yAxis: {
        type: "value",
        show: false,
      },
      series: [
        {
          type: "line",
          data,
          smooth: true,
          symbol: "none",
          lineStyle: {
            color,
            width: 1.5,
          },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: color + "40" },
                { offset: 1, color: color + "00" },
              ],
            },
          },
        },
      ],
    };

    instanceRef.current.setOption(option);

    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, [data, color]);

  return (
    <div
      ref={chartRef}
      className={className}
      style={{ height: `${chartHeight}px`, width: "100%" }}
    />
  );
}
