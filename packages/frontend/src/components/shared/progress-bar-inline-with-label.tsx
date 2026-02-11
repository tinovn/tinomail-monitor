import { cn } from "@/lib/classname-utils";

interface ProgressBarInlineWithLabelProps {
  percent: number;
  absoluteText?: string;
  width?: string;
  className?: string;
}

function getBarColor(percent: number): string {
  if (percent < 50) return "bg-bar-low";
  if (percent < 70) return "bg-bar-medium";
  if (percent < 85) return "bg-bar-high";
  return "bg-bar-critical";
}

function getTextColor(percent: number): string {
  if (percent < 50) return "text-bar-low";
  if (percent < 70) return "text-bar-medium";
  if (percent < 85) return "text-bar-high";
  return "text-bar-critical";
}

export function ProgressBarInlineWithLabel({
  percent,
  absoluteText,
  width = "w-28",
  className,
}: ProgressBarInlineWithLabelProps) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("h-3.5 overflow-hidden rounded-sm bg-muted", width)}>
        <div
          className={cn("h-full rounded-sm transition-all", getBarColor(clamped))}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className={cn("font-mono-data whitespace-nowrap", getTextColor(clamped))}>
        {Math.round(clamped)}%
      </span>
      {absoluteText && (
        <span className="font-mono-data whitespace-nowrap text-muted-foreground">
          {absoluteText}
        </span>
      )}
    </div>
  );
}
