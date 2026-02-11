import { StatusIndicatorDot } from "@/components/shared/status-indicator-dot";

interface ProcessHealth {
  name: string;
  running: boolean;
  pid: number | null;
  cpuPercent: number;
  memoryMB: number;
}

interface RunningServicesPanelProps {
  processes: ProcessHealth[];
  detectedServices?: string[];
}

/** Display name mapping for process names */
const PROCESS_LABELS: Record<string, string> = {
  wildduck: "WildDuck",
  haraka: "Haraka SMTP",
  "zone-mta": "ZoneMTA",
  rspamd: "Rspamd",
  "redis-server": "Redis",
  mongod: "MongoDB",
  clamav: "ClamAV",
};

function formatMemory(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export function RunningServicesPanel({ processes, detectedServices }: RunningServicesPanelProps) {
  // Merge detected services that aren't in the process list (e.g. clamav)
  const extraServices = (detectedServices ?? []).filter(
    (s) => !processes.some((p) => p.name === s || PROCESS_LABELS[p.name]?.toLowerCase() === s)
  );

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-4 text-lg font-semibold text-foreground">Running Services</h2>

      <div className="space-y-2">
        {processes.map((proc) => (
          <div
            key={proc.name}
            className="flex items-center justify-between rounded-md bg-background px-3 py-2"
          >
            <div className="flex items-center gap-3">
              <StatusIndicatorDot
                status={proc.running ? "ok" : "critical"}
                size="md"
              />
              <span className="text-sm font-medium text-foreground">
                {PROCESS_LABELS[proc.name] ?? proc.name}
              </span>
            </div>

            {proc.running ? (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>PID {proc.pid}</span>
                <span>CPU {proc.cpuPercent}%</span>
                <span>MEM {formatMemory(proc.memoryMB)}</span>
              </div>
            ) : (
              <span className="text-xs text-status-critical">stopped</span>
            )}
          </div>
        ))}

        {/* Show detected services not monitored as processes */}
        {extraServices.map((svc) => (
          <div
            key={svc}
            className="flex items-center justify-between rounded-md bg-background px-3 py-2"
          >
            <div className="flex items-center gap-3">
              <StatusIndicatorDot status="ok" size="md" />
              <span className="text-sm font-medium text-foreground">
                {PROCESS_LABELS[svc] ?? svc}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">detected</span>
          </div>
        ))}
      </div>

      {processes.length === 0 && extraServices.length === 0 && (
        <p className="text-sm text-muted-foreground">No service data available</p>
      )}
    </div>
  );
}
