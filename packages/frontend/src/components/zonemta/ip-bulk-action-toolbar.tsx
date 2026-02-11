import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { Play, Pause, Ban, CheckCircle } from "lucide-react";
import { cn } from "@/lib/classname-utils";

interface IpBulkActionToolbarProps {
  selectedIps: string[];
  onActionComplete?: () => void;
}

export function IpBulkActionToolbar({ selectedIps, onActionComplete }: IpBulkActionToolbarProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const bulkActionMutation = useMutation({
    mutationFn: async (action: string) => {
      return apiClient.post("/ips/bulk-action", {
        ips: selectedIps,
        action,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zonemta"] });
      onActionComplete?.();
    },
  });

  const handleAction = async (action: string) => {
    setIsProcessing(true);
    try {
      await bulkActionMutation.mutateAsync(action);
    } finally {
      setIsProcessing(false);
    }
  };

  const actions = [
    { id: "activate", label: "Activate", icon: Play, color: "text-status-ok" },
    { id: "pause", label: "Pause", icon: Pause, color: "text-status-warning" },
    { id: "quarantine", label: "Quarantine", icon: Ban, color: "text-status-critical" },
  ];

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-primary bg-primary/10">
      <div className="flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">
          {selectedIps.length} IP{selectedIps.length !== 1 ? "s" : ""} selected
        </span>
      </div>

      <div className="h-4 w-px bg-border" />

      <div className="flex gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action.id)}
            disabled={isProcessing}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              "border border-border bg-surface hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed",
              action.color
            )}
          >
            <action.icon className="h-3.5 w-3.5" />
            {action.label}
          </button>
        ))}
      </div>

      {isProcessing && (
        <span className="ml-auto text-sm text-muted-foreground animate-pulse">
          Processing...
        </span>
      )}
    </div>
  );
}
