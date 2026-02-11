import { format } from "date-fns";
import { CheckCircle2, XCircle, AlertCircle, Clock, ArrowRight, Ban } from "lucide-react";
import { cn } from "@/lib/classname-utils";

interface TraceEvent {
  time: string;
  eventType: string;
  mtaNode: string;
  sendingIp: string;
  statusCode: number | null;
  statusMessage: string | null;
  fromAddress: string;
  toAddress: string;
  messageId: string;
  queueId: string;
}

interface MessageTraceTimelineStepProps {
  event: TraceEvent;
  isFirst: boolean;
  isLast: boolean;
}

export function MessageTraceTimelineStep({ event }: MessageTraceTimelineStepProps) {
  const getEventConfig = (eventType: string) => {
    const type = eventType.toLowerCase();

    if (type === "delivered") {
      return {
        icon: CheckCircle2,
        color: "text-green-400",
        bgColor: "bg-green-500/20",
        borderColor: "border-green-500/30",
      };
    }

    if (type === "bounced") {
      return {
        icon: XCircle,
        color: "text-red-400",
        bgColor: "bg-red-500/20",
        borderColor: "border-red-500/30",
      };
    }

    if (type === "rejected") {
      return {
        icon: Ban,
        color: "text-red-400",
        bgColor: "bg-red-500/20",
        borderColor: "border-red-500/30",
      };
    }

    if (type === "deferred") {
      return {
        icon: AlertCircle,
        color: "text-yellow-400",
        bgColor: "bg-yellow-500/20",
        borderColor: "border-yellow-500/30",
      };
    }

    if (type === "queued") {
      return {
        icon: Clock,
        color: "text-blue-400",
        bgColor: "bg-blue-500/20",
        borderColor: "border-blue-500/30",
      };
    }

    if (type === "transferred") {
      return {
        icon: ArrowRight,
        color: "text-purple-400",
        bgColor: "bg-purple-500/20",
        borderColor: "border-purple-500/30",
      };
    }

    return {
      icon: Clock,
      color: "text-gray-400",
      bgColor: "bg-gray-500/20",
      borderColor: "border-gray-500/30",
    };
  };

  const config = getEventConfig(event.eventType);
  const Icon = config.icon;

  return (
    <div className="relative flex gap-6 pl-12">
      {/* Icon Circle */}
      <div
        className={cn(
          "absolute left-0 flex h-8 w-8 items-center justify-center rounded-full border-2",
          config.bgColor,
          config.borderColor
        )}
      >
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={cn("text-sm font-semibold", config.color)}>
                {event.eventType}
              </span>
              {event.statusCode && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    event.statusCode >= 200 && event.statusCode < 300
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  )}
                >
                  {event.statusCode}
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {format(new Date(event.time), "MMM dd, yyyy HH:mm:ss.SSS")}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="mt-3 space-y-1.5 rounded-md border border-border bg-background p-3 text-xs">
          <div className="flex gap-4">
            <div className="flex-1">
              <span className="text-muted-foreground">Node:</span>{" "}
              <span className="font-mono text-foreground">{event.mtaNode}</span>
            </div>
            <div className="flex-1">
              <span className="text-muted-foreground">IP:</span>{" "}
              <span className="font-mono text-foreground">{event.sendingIp}</span>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <span className="text-muted-foreground">Queue ID:</span>{" "}
              <span className="font-mono text-foreground">{event.queueId}</span>
            </div>
          </div>

          {event.statusMessage && (
            <div className="pt-1">
              <span className="text-muted-foreground">Message:</span>{" "}
              <span className="text-foreground">{event.statusMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
