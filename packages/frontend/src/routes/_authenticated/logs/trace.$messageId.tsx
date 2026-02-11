import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { MessageTraceVerticalTimeline } from "@/components/logs/message-trace-vertical-timeline";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";
import { ArrowLeft, Clock } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/logs/trace/$messageId")({
  component: MessageTracePage,
});

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

function MessageTracePage() {
  const { messageId } = Route.useParams() as { messageId: string };
  const navigate = useNavigate();

  const { data: events, isLoading } = useQuery({
    queryKey: ["logs", "trace", messageId],
    queryFn: () => apiClient.get<TraceEvent[]>(`/logs/trace/${messageId}`),
  });

  if (isLoading) {
    return <LoadingSkeletonPlaceholder className="h-96" />;
  }

  if (!events || events.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <button
            onClick={() => navigate({ to: "/logs" })}
            className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Logs
          </button>
          <h1 className="text-2xl font-bold text-foreground">Message Trace</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{messageId}</p>
        </div>

        <div className="flex items-center justify-center rounded-lg border border-border bg-muted/20 p-12">
          <p className="text-sm text-muted-foreground">No trace events found for this message</p>
        </div>
      </div>
    );
  }

  const firstEvent = new Date(events[0].time);
  const lastEvent = new Date(events[events.length - 1].time);
  const totalElapsed = Math.round((lastEvent.getTime() - firstEvent.getTime()) / 1000);

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate({ to: "/logs" })}
          className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Logs
        </button>
        <h1 className="text-2xl font-bold text-foreground">Message Trace</h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">{messageId}</p>
      </div>

      {/* Summary Bar */}
      <div className="flex items-center gap-6 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">Total Elapsed Time</div>
            <div className="text-lg font-semibold text-foreground">
              {totalElapsed < 60
                ? `${totalElapsed}s`
                : `${Math.floor(totalElapsed / 60)}m ${totalElapsed % 60}s`}
            </div>
          </div>
        </div>

        <div className="h-8 w-px bg-border" />

        <div>
          <div className="text-xs text-muted-foreground">Events</div>
          <div className="text-lg font-semibold text-foreground">{events.length}</div>
        </div>

        <div className="h-8 w-px bg-border" />

        <div className="flex-1">
          <div className="text-xs text-muted-foreground">Route</div>
          <div className="truncate text-sm font-medium text-foreground">
            {events[0].fromAddress} → {events[0].toAddress}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-6 text-lg font-semibold text-foreground">Delivery Timeline</h2>
        <MessageTraceVerticalTimeline events={events} />
      </div>
    </div>
  );
}
