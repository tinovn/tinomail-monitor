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
      color: "#777a84",
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
        color: "#777a84",
        fontSize: 10,
      },
      axisLine: {
        lineStyle: {
          color: "#181a21",
        },
      },
      splitLine: {
        lineStyle: {
          color: "#181a21",
        },
      },
    },
    yAxis: {
      axisLabel: {
        color: "#777a84",
        fontSize: 10,
      },
      axisLine: {
        lineStyle: {
          color: "#181a21",
        },
      },
      splitLine: {
        lineStyle: {
          color: "#181a21",
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
