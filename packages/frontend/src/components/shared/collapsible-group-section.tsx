import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/classname-utils";
import { StatusIndicatorDot } from "./status-indicator-dot";

type StatusType = "ok" | "warning" | "critical" | "muted";

interface CollapsibleGroupSectionProps {
  title: string;
  status?: StatusType;
  badge?: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleGroupSection({
  title,
  status,
  badge,
  count,
  defaultOpen = true,
  children,
  className,
}: CollapsibleGroupSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("border-b border-border", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 bg-muted/30 px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        {status && <StatusIndicatorDot status={status} size="sm" />}
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {badge && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {badge}
          </span>
        )}
        {count != null && (
          <span className="text-xs text-muted-foreground">({count})</span>
        )}
      </button>
      {open && children}
    </div>
  );
}
