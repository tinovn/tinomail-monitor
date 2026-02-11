import { cn } from "@/lib/classname-utils";

interface UptimeDisplayLabelProps {
  since: Date | string;
  className?: string;
}

export function UptimeDisplayLabel({ since, className }: UptimeDisplayLabelProps) {
  const start = typeof since === "string" ? new Date(since) : since;
  const diffMs = Date.now() - start.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return (
    <span className={cn("font-mono-data text-muted-foreground", className)}>
      {days}d {hours}h
    </span>
  );
}
