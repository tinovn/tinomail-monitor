import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clock } from "lucide-react";
import { apiClient } from "@/lib/api-http-client";
import { cn } from "@/lib/classname-utils";

interface AlertActionButtonsProps {
  alertId: number;
  onSuccess?: () => void;
}

type SnoozeDuration = "1h" | "4h" | "24h";

export function AlertAcknowledgeAndSnoozeActionButtons({
  alertId,
  onSuccess,
}: AlertActionButtonsProps) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const queryClient = useQueryClient();

  const acknowledgeMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/alerts/${alertId}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      onSuccess?.();
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async (duration: SnoozeDuration) => {
      await apiClient.post(`/alerts/${alertId}/snooze`, { duration });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      setSnoozeOpen(false);
      onSuccess?.();
    },
  });

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => acknowledgeMutation.mutate()}
        disabled={acknowledgeMutation.isPending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          "border border-border bg-surface hover:bg-surface/80",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
        title="Acknowledge alert"
      >
        <Check className="h-4 w-4" />
        {acknowledgeMutation.isPending ? "..." : "Ack"}
      </button>

      <div className="relative">
        <button
          onClick={() => setSnoozeOpen(!snoozeOpen)}
          disabled={snoozeMutation.isPending}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            "border border-border bg-surface hover:bg-surface/80",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
          title="Snooze alert"
        >
          <Clock className="h-4 w-4" />
          {snoozeMutation.isPending ? "..." : "Snooze"}
        </button>

        {snoozeOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setSnoozeOpen(false)}
            />
            <div className="absolute right-0 top-full z-20 mt-1 w-32 rounded-md border border-border bg-surface shadow-lg">
              {(["1h", "4h", "24h"] as SnoozeDuration[]).map((duration) => (
                <button
                  key={duration}
                  onClick={() => snoozeMutation.mutate(duration)}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-surface/80"
                >
                  {duration}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
