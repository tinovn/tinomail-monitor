import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/classname-utils";

interface MetricStatCardProps {
  label: string;
  value: string | number;
  trend?: "up" | "down";
  trendValue?: string;
  className?: string;
}

export function MetricStatCard({
  label,
  value,
  trend,
  trendValue,
  className,
}: MetricStatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-4",
        className,
      )}
    >
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {trend && trendValue && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              trend === "up" ? "text-status-ok" : "text-status-critical",
            )}
          >
            {trend === "up" ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
    </div>
  );
}
