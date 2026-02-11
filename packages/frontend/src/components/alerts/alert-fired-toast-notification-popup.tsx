import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import type { SeverityLevel } from "@tinomail/shared";
import { useAlertNotificationStore } from "@/stores/alert-notification-toast-and-count-store";
import { cn } from "@/lib/classname-utils";

export function AlertFiredToastNotificationPopup() {
  const navigate = useNavigate();
  const latestAlert = useAlertNotificationStore((state) => state.latestAlert);
  const clearLatest = useAlertNotificationStore((state) => state.clearLatest);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (latestAlert) {
      setVisible(true);

      // Auto-dismiss after 10s
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(clearLatest, 300); // Clear after fade animation
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [latestAlert, clearLatest]);

  if (!latestAlert || !visible) return null;

  const severity = latestAlert.severity as SeverityLevel;

  const severityStyles = {
    critical: {
      border: "border-red-500",
      bg: "bg-red-500/10",
      text: "text-red-500",
    },
    warning: {
      border: "border-yellow-500",
      bg: "bg-yellow-500/10",
      text: "text-yellow-500",
    },
    info: {
      border: "border-blue-500",
      bg: "bg-blue-500/10",
      text: "text-blue-500",
    },
  };

  const style = severityStyles[severity] || severityStyles.info;

  const handleClick = () => {
    setVisible(false);
    clearLatest();
    navigate({ to: "/alerts" });
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVisible(false);
    setTimeout(clearLatest, 300);
  };

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 w-96 rounded-lg border-2 p-4 shadow-lg cursor-pointer transition-all",
        style.border,
        style.bg,
        visible ? "animate-in slide-in-from-right" : "animate-out slide-out-to-right"
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">
          {severity === "critical" ? "🔴" : severity === "warning" ? "🟡" : "🔵"}
        </span>

        <div className="flex-1">
          <div className="flex items-start justify-between">
            <h4 className={cn("font-semibold text-sm", style.text)}>
              {severity.toUpperCase()} Alert
            </h4>
            <button
              onClick={handleClose}
              className="rounded-md p-1 hover:bg-black/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm mt-1 text-foreground">
            {latestAlert.message || "Alert triggered"}
          </p>

          {latestAlert.nodeId && (
            <p className="text-xs mt-2 text-muted-foreground">
              Node: <span className="font-mono">{latestAlert.nodeId}</span>
            </p>
          )}

          <p className="text-xs mt-2 text-muted-foreground">
            Click to view alert details
          </p>
        </div>
      </div>
    </div>
  );
}
