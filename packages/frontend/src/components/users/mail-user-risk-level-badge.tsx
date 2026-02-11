import { cn } from "@/lib/classname-utils";

type RiskLevel = "Low" | "Medium" | "High";

interface MailUserRiskLevelBadgeProps {
  level: RiskLevel;
  className?: string;
}

export function MailUserRiskLevelBadge({
  level,
  className,
}: MailUserRiskLevelBadgeProps) {
  const colorClasses = {
    Low: "bg-status-ok/20 text-status-ok border-status-ok/40",
    Medium: "bg-status-warning/20 text-status-warning border-status-warning/40",
    High: "bg-status-critical/20 text-status-critical border-status-critical/40",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        colorClasses[level],
        className
      )}
    >
      {level}
    </span>
  );
}
