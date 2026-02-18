import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowUp, ArrowDown, AlertTriangle, CheckCircle, Zap } from "lucide-react";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { cn } from "@/lib/classname-utils";

interface ReplEvent {
  time: string;
  nodeId: string;
  eventType: string;
  oldRole: string | null;
  newRole: string | null;
  details: string | null;
}

const EVENT_STYLES: Record<string, { color: string; bg: string; icon: typeof ArrowUp }> = {
  step_up:            { color: "text-status-ok",       bg: "bg-status-ok/20",       icon: ArrowUp },
  member_recovered:   { color: "text-status-ok",       bg: "bg-status-ok/20",       icon: CheckCircle },
  step_down:          { color: "text-status-critical",  bg: "bg-status-critical/20", icon: ArrowDown },
  member_unreachable: { color: "text-status-critical",  bg: "bg-status-critical/20", icon: AlertTriangle },
  election:           { color: "text-purple-400",       bg: "bg-purple-400/20",      icon: Zap },
};

function getEventStyle(eventType: string) {
  return EVENT_STYLES[eventType] ?? { color: "text-muted-foreground", bg: "bg-muted", icon: Zap };
}

export function ReplEventTimelinePanel() {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data: events, isLoading } = useQuery({
    queryKey: ["mongodb", "repl-events", from.toISOString(), to.toISOString()],
    queryFn: () =>
      apiClient.get<ReplEvent[]>("/mongodb/repl-events", {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  if (isLoading) {
    return (
      <div className="flex h-[120px] items-center justify-center text-xs text-muted-foreground">
        Loading events...
      </div>
    );
  }

  const displayEvents = (events ?? []).slice(0, 20);

  if (displayEvents.length === 0) {
    return (
      <div className="flex h-[80px] items-center justify-center text-xs text-muted-foreground">
        No replica set events in this time range
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {displayEvents.map((event, idx) => {
        const style = getEventStyle(event.eventType);
        const Icon = style.icon;
        const isLast = idx === displayEvents.length - 1;

        return (
          <div key={`${event.time}-${event.nodeId}-${idx}`} className="flex gap-3">
            {/* Timeline column */}
            <div className="flex flex-col items-center">
              <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", style.bg)}>
                <Icon className={cn("h-3 w-3", style.color)} />
              </div>
              {!isLast && <div className="w-px flex-1 bg-border" style={{ minHeight: "16px" }} />}
            </div>

            {/* Content */}
            <div className={cn("pb-3 min-w-0", isLast && "pb-0")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", style.bg, style.color)}>
                  {event.eventType.replace(/_/g, " ").toUpperCase()}
                </span>
                <span className="text-xs font-medium text-foreground">{event.nodeId}</span>
                {event.oldRole && event.newRole && (
                  <span className="text-xs text-muted-foreground">
                    {event.oldRole} → {event.newRole}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(event.time), { addSuffix: true })}
                {event.details && <span className="ml-2 opacity-70">{event.details}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
