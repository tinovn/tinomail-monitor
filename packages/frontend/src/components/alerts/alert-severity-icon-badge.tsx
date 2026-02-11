import type { SeverityLevel } from "@tinomail/shared";
import { cn } from "@/lib/classname-utils";

interface AlertSeverityIconBadgeProps {
  severity: SeverityLevel;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function AlertSeverityIconBadge({
  severity,
  showLabel = true,
  size = "md",
}: AlertSeverityIconBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const variants = {
    critical: {
      icon: "🔴",
      bg: "bg-red-500/10",
      text: "text-red-500",
      border: "border-red-500/20",
    },
    warning: {
      icon: "🟡",
      bg: "bg-yellow-500/10",
      text: "text-yellow-500",
      border: "border-yellow-500/20",
    },
    info: {
      icon: "🔵",
      bg: "bg-blue-500/10",
      text: "text-blue-500",
      border: "border-blue-500/20",
    },
  };

  const variant = variants[severity];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-medium",
        variant.bg,
        variant.text,
        variant.border,
        sizeClasses[size],
      )}
    >
      <span>{variant.icon}</span>
      {showLabel && <span className="capitalize">{severity}</span>}
    </span>
  );
}
