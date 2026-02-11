import { cn } from "@/lib/classname-utils";

type StatusType = "ok" | "warning" | "critical" | "muted";

interface StatusIndicatorDotProps {
  status: StatusType;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

const statusStyles: Record<StatusType, string> = {
  ok: "bg-status-ok",
  warning: "bg-status-warning",
  critical: "bg-status-critical",
  muted: "bg-status-muted",
};

const sizeStyles = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
};

export function StatusIndicatorDot({
  status,
  label,
  size = "md",
  className,
}: StatusIndicatorDotProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn("rounded-full", sizeStyles[size], statusStyles[status])}
        aria-label={status}
      />
      {label && (
        <span className={cn("text-foreground", size === "sm" ? "text-xs" : "text-sm")}>
          {label}
        </span>
      )}
    </div>
  );
}
