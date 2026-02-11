import { useRef, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";

interface EchartsBaseWrapperProps {
  option: EChartsOption;
  loading?: boolean;
  height?: number | string;
  className?: string;
}

export function EchartsBaseWrapper({
  option,
  loading = false,
  height = 250,
  className,
}: EchartsBaseWrapperProps) {
  const chartRef = useRef<ReactECharts>(null);

  useEffect(() => {
    const handleResize = () => {
      chartRef.current?.getEchartsInstance().resize();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (loading) {
    const heightStyle = typeof height === "number" ? `h-[${height}px]` : "";
    return (
      <LoadingSkeletonPlaceholder
        className={`w-full ${heightStyle}`}
      />
    );
  }

  const darkTheme: EChartsOption = {
    backgroundColor: "transparent",
    textStyle: {
      color: "oklch(0.58 0.015 270)",
      fontSize: 10,
    },
    grid: {
      left: "3%",
      right: "3%",
      bottom: "8%",
      top: "8%",
      containLabel: true,
    },
    tooltip: {
      textStyle: {
        fontSize: 11,
      },
    },
    xAxis: {
      axisLabel: {
        color: "oklch(0.58 0.015 270)",
        fontSize: 10,
      },
      axisLine: {
        lineStyle: {
          color: "oklch(0.22 0.014 270)",
        },
      },
      splitLine: {
        lineStyle: {
          color: "oklch(0.22 0.014 270)",
        },
      },
    },
    yAxis: {
      axisLabel: {
        color: "oklch(0.58 0.015 270)",
        fontSize: 10,
      },
      axisLine: {
        lineStyle: {
          color: "oklch(0.22 0.014 270)",
        },
      },
      splitLine: {
        lineStyle: {
          color: "oklch(0.22 0.014 270)",
        },
      },
    },
    ...option,
  };

  return (
    <ReactECharts
      ref={chartRef}
      option={darkTheme}
      style={{ height, width: "100%" }}
      className={className}
      opts={{ renderer: "canvas" }}
    />
  );
}
