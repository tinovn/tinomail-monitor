import { MessageTraceTimelineStep } from "@/components/logs/message-trace-timeline-step";

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

interface MessageTraceVerticalTimelineProps {
  events: TraceEvent[];
}

export function MessageTraceVerticalTimeline({ events }: MessageTraceVerticalTimelineProps) {
  return (
    <div className="relative space-y-8">
      {/* Vertical Line */}
      <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" />

      {/* Timeline Steps */}
      {events.map((event, index) => (
        <MessageTraceTimelineStep
          key={`${event.time}-${index}`}
          event={event}
          isFirst={index === 0}
          isLast={index === events.length - 1}
        />
      ))}
    </div>
  );
}
