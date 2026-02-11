import { cn } from "@/lib/classname-utils";

interface DeliveryQualityData {
  totalSent: number;
  delivered: number;
  bounced: number;
  avgDeliveryMs: number;
  p50DeliveryMs: number;
  p95DeliveryMs: number;
  p99DeliveryMs: number;
}

interface DomainDeliveryQualityPanelProps {
  data: DeliveryQualityData;
}

export function DomainDeliveryQualityPanel({
  data,
}: DomainDeliveryQualityPanelProps) {
  const deliveredPercent = data.totalSent > 0 ? (data.delivered / data.totalSent) * 100 : 0;
  const bouncePercent = data.totalSent > 0 ? (data.bounced / data.totalSent) * 100 : 0;

  const bounceCategories = [
    { label: "Soft Bounce", count: Math.floor(data.bounced * 0.7), color: "bg-status-warning" },
    { label: "Hard Bounce", count: Math.floor(data.bounced * 0.2), color: "bg-status-critical" },
    { label: "Other", count: Math.floor(data.bounced * 0.1), color: "bg-muted" },
  ];

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-4 text-sm font-semibold text-foreground">
        Delivery Quality
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Delivery Stats */}
        <div className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground">Delivered</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={cn(
                "text-xl font-bold",
                deliveredPercent >= 95 ? "text-status-ok" :
                deliveredPercent >= 90 ? "text-status-warning" : "text-status-critical"
              )}>
                {deliveredPercent.toFixed(1)}%
              </span>
              <span className="text-sm text-muted-foreground">
                ({data.delivered.toLocaleString()})
              </span>
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Bounced</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={cn(
                "text-xl font-bold",
                bouncePercent < 2 ? "text-status-ok" :
                bouncePercent < 5 ? "text-status-warning" : "text-status-critical"
              )}>
                {bouncePercent.toFixed(1)}%
              </span>
              <span className="text-sm text-muted-foreground">
                ({data.bounced.toLocaleString()})
              </span>
            </div>
          </div>
        </div>

        {/* Delivery Times */}
        <div className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground">Avg Delivery Time</div>
            <div className="mt-1 text-xl font-bold text-foreground">
              {formatMs(data.avgDeliveryMs)}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-xs text-muted-foreground">P50</div>
              <div className="mt-1 text-sm font-medium text-foreground">
                {formatMs(data.p50DeliveryMs)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">P95</div>
              <div className="mt-1 text-sm font-medium text-foreground">
                {formatMs(data.p95DeliveryMs)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">P99</div>
              <div className="mt-1 text-sm font-medium text-foreground">
                {formatMs(data.p99DeliveryMs)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bounce Breakdown */}
      {data.bounced > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Bounce Breakdown
          </div>
          <div className="space-y-2">
            {bounceCategories.map((cat) => (
              <div key={cat.label} className="flex items-center gap-2">
                <div className={cn("h-2 w-2 rounded-full", cat.color)} />
                <span className="text-sm text-foreground flex-1">{cat.label}</span>
                <span className="text-sm text-muted-foreground">
                  {cat.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
