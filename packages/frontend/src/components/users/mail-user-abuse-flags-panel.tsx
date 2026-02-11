import { cn } from "@/lib/classname-utils";

export interface AbuseFlagItem {
  userAddress: string;
  reason: string;
  timestamp: string;
  severity: "low" | "medium" | "high";
}

interface MailUserAbuseFlagsPanelProps {
  flags: AbuseFlagItem[];
  className?: string;
}

export function MailUserAbuseFlagsPanel({
  flags,
  className,
}: MailUserAbuseFlagsPanelProps) {
  const severityStyles = {
    low: "border-status-warning/40 bg-status-warning/10",
    medium: "border-status-warning/60 bg-status-warning/20",
    high: "border-status-critical/60 bg-status-critical/20",
  };

  const severityTextStyles = {
    low: "text-status-warning",
    medium: "text-status-warning",
    high: "text-status-critical",
  };

  return (
    <div className={cn("rounded-lg border border-border bg-surface p-4", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Abuse Indicators
        </h3>
        {flags.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {flags.length} flag{flags.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {flags.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No abuse indicators detected
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map((flag, index) => (
            <div
              key={index}
              className={cn(
                "rounded-lg border p-3",
                severityStyles[flag.severity]
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-foreground">
                      {flag.userAddress}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold uppercase",
                        severityTextStyles[flag.severity]
                      )}
                    >
                      {flag.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground/90">
                    {flag.reason}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(flag.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
