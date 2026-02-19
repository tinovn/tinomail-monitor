import { useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";

interface Counters {
  delivered: number;
  bounced: number;
  deferred: number;
  rejected: number;
}

export function EmailFlowCounterCards() {
  const { from, to, preset, autoRefresh, refreshRange } = useTimeRangeStore();
  const [counters, setCounters] = useState<Counters>({
    delivered: 0,
    bounced: 0,
    deferred: 0,
    rejected: 0,
  });

  const fetchCounters = useCallback(async () => {
    try {
      refreshRange();
      const { from: freshFrom, to: freshTo } = useTimeRangeStore.getState();
      const data = await apiClient.get<Array<{ group: string; count: string }>>(
        `/email/stats?from=${freshFrom.toISOString()}&to=${freshTo.toISOString()}&groupBy=event_type`
      );

      const initial: Counters = { delivered: 0, bounced: 0, deferred: 0, rejected: 0 };
      for (const row of data) {
        const key = row.group as keyof Counters;
        if (key in initial) {
          initial[key] = Number(row.count) || 0;
        }
      }
      setCounters(initial);
    } catch {
      // Silently fail — WebSocket will still update
    }
  }, [refreshRange]);

  useEffect(() => {
    fetchCounters();
    const interval = autoRefresh
      ? setInterval(fetchCounters, autoRefresh * 1000)
      : undefined;
    return () => { if (interval) clearInterval(interval); };
  }, [fetchCounters, autoRefresh, preset]);

  // Re-fetch when time range changes (user clicks preset)
  useEffect(() => {
    fetchCounters();
  }, [from, to, fetchCounters]);

  // WebSocket for real-time increments
  useEffect(() => {
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

    return () => { socket.disconnect(); };
  }, []);

  const presetLabel = preset === "custom" ? "selected range" : `last ${preset}`;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <CounterCard
        label="Delivered"
        value={counters.delivered}
        color="text-green-500"
        bgColor="bg-green-500/10"
        timeLabel={presetLabel}
      />
      <CounterCard
        label="Bounced"
        value={counters.bounced}
        color="text-red-500"
        bgColor="bg-red-500/10"
        timeLabel={presetLabel}
      />
      <CounterCard
        label="Deferred"
        value={counters.deferred}
        color="text-yellow-500"
        bgColor="bg-yellow-500/10"
        timeLabel={presetLabel}
      />
      <CounterCard
        label="Rejected"
        value={counters.rejected}
        color="text-orange-500"
        bgColor="bg-orange-500/10"
        timeLabel={presetLabel}
      />
    </div>
  );
}

interface CounterCardProps {
  label: string;
  value: number;
  color: string;
  bgColor: string;
  timeLabel: string;
}

function CounterCard({ label, value, color, bgColor, timeLabel }: CounterCardProps) {
  return (
    <div className={`rounded-md border border-border ${bgColor} p-2`}>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-mono-data font-bold ${color}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-[10px] text-muted-foreground">{timeLabel}</div>
    </div>
  );
}
