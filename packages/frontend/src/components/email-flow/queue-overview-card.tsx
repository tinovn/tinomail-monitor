import { useEffect, useState } from "react";
import { SparklineMiniChart } from "@/components/charts/sparkline-mini-chart";

export function QueueOverviewCard() {
  const [queueSize, setQueueSize] = useState(0);
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    fetchQueueData();
    const interval = setInterval(fetchQueueData, 10000); // 10s refresh
    return () => clearInterval(interval);
  }, []);

  const fetchQueueData = async () => {
    try {
      // Mock data - replace with actual ZoneMTA queue API call
      const mockSize = Math.floor(Math.random() * 5000) + 1000;
      setQueueSize(mockSize);
      setHistory((prev) => [...prev.slice(-29), mockSize]);
    } catch (error) {
      console.error("Failed to fetch queue data:", error);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Total Queue Size
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Messages waiting to be delivered
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-4xl font-bold text-foreground">
            {queueSize.toLocaleString()}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">messages</div>
        </div>

        <div className="h-16 w-1/2">
          <SparklineMiniChart
            data={history}
            color="#3b82f6"
            height={64}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4">
        <QueueStat label="Oldest" value="2h 15m" />
        <QueueStat label="Avg Age" value="18m" />
        <QueueStat label="Processing" value="142/s" />
      </div>
    </div>
  );
}

interface QueueStatProps {
  label: string;
  value: string;
}

function QueueStat({ label, value }: QueueStatProps) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}
