import { cn } from "@/lib/classname-utils";
import { StatusIndicatorDot } from "./status-indicator-dot";

type StatusType = "ok" | "warning" | "critical" | "muted";

interface StatusBadgeWithDotProps {
  status: StatusType;
  label: string;
  badge?: string;
  className?: string;
}

export function StatusBadgeWithDot({
  status,
  label,
  badge,
  className,
}: StatusBadgeWithDotProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <StatusIndicatorDot status={status} size="sm" />
      <span className="text-sm font-medium text-foreground">{label}</span>
      {badge && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {badge}
        </span>
      )}
    </div>
  );
}
