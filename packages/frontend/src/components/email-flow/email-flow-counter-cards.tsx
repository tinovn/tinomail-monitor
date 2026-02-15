import { useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { apiClient } from "@/lib/api-http-client";

interface Counters {
  delivered: number;
  bounced: number;
  deferred: number;
  rejected: number;
}

export function EmailFlowCounterCards() {
  const [counters, setCounters] = useState<Counters>({
    delivered: 0,
    bounced: 0,
    deferred: 0,
    rejected: 0,
  });

  // Fetch initial counters from email_events for last hour
  const fetchInitialCounters = useCallback(async () => {
    try {
      const to = new Date();
      const from = new Date(to.getTime() - 60 * 60 * 1000);
      const data = await apiClient.get<Array<{ event_type: string; count: number }>>(
        `/email/stats?from=${from.toISOString()}&to=${to.toISOString()}&groupBy=event_type`
      );

      const initial: Counters = { delivered: 0, bounced: 0, deferred: 0, rejected: 0 };
      for (const row of data) {
        const key = row.event_type as keyof Counters;
        if (key in initial) {
          initial[key] = Number(row.count) || 0;
        }
      }
      setCounters(initial);
    } catch {
      // Silently fail — WebSocket will still update
    }
  }, []);

  useEffect(() => {
    fetchInitialCounters();

    const socket = io("/", { path: "/socket.io" });
    socket.emit("join", "email-flow");

    socket.on("email:throughput", (data: Record<string, number>) => {
      setCounters((prev) => ({
        delivered: prev.delivered + (data.delivered || 0),
        bounced: prev.bounced + (data.bounced || 0),
        deferred: prev.deferred + (data.deferred || 0),
        rejected: prev.rejected + (data.rejected || 0),
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchInitialCounters]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <CounterCard
        label="Delivered"
        value={counters.delivered}
        color="text-green-500"
        bgColor="bg-green-500/10"
      />
      <CounterCard
        label="Bounced"
        value={counters.bounced}
        color="text-red-500"
        bgColor="bg-red-500/10"
      />
      <CounterCard
        label="Deferred"
        value={counters.deferred}
        color="text-yellow-500"
        bgColor="bg-yellow-500/10"
      />
      <CounterCard
        label="Rejected"
        value={counters.rejected}
        color="text-orange-500"
        bgColor="bg-orange-500/10"
      />
    </div>
  );
}

interface CounterCardProps {
  label: string;
  value: number;
  color: string;
  bgColor: string;
}

function CounterCard({ label, value, color, bgColor }: CounterCardProps) {
  return (
    <div className={`rounded-md border border-border ${bgColor} p-2`}>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-mono-data font-bold ${color}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-[10px] text-muted-foreground">last hour</div>
    </div>
  );
}
