import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";

interface RspamdSummary {
  scanned: number;
  ham: number;
  spam: number;
  greylist: number;
  rejected: number;
  learnedHam: number;
  learnedSpam: number;
}

export function RspamdSummaryStatCards() {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data, isLoading } = useQuery({
    queryKey: ["spam", "rspamd", "summary", from, to],
    queryFn: () =>
      apiClient.get<RspamdSummary>("/spam/rspamd/summary", {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <LoadingSkeletonPlaceholder key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const scannedPerHour = Math.round(data.scanned / 24);
  const hamPercent = data.scanned ? ((data.ham / data.scanned) * 100).toFixed(1) : "0";
  const spamPercent = data.scanned ? ((data.spam / data.scanned) * 100).toFixed(1) : "0";
  const rejectedPercent = data.scanned ? ((data.rejected / data.scanned) * 100).toFixed(1) : "0";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard
        label="Scanned/h"
        value={scannedPerHour.toLocaleString()}
        subtitle={`${data.scanned.toLocaleString()} total`}
        color="text-blue-500"
        bgColor="bg-blue-500/10"
      />
      <StatCard
        label="Ham (Clean)"
        value={data.ham.toLocaleString()}
        subtitle={`${hamPercent}% of scanned`}
        color="text-green-500"
        bgColor="bg-green-500/10"
      />
      <StatCard
        label="Spam Detected"
        value={data.spam.toLocaleString()}
        subtitle={`${spamPercent}% of scanned`}
        color="text-yellow-500"
        bgColor="bg-yellow-500/10"
      />
      <StatCard
        label="Rejected"
        value={data.rejected.toLocaleString()}
        subtitle={`${rejectedPercent}% of scanned`}
        color="text-red-500"
        bgColor="bg-red-500/10"
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  subtitle: string;
  color: string;
  bgColor: string;
}

function StatCard({ label, value, subtitle, color, bgColor }: StatCardProps) {
  return (
    <div className={`rounded-md border border-border ${bgColor} p-2`}>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-mono-data font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{subtitle}</div>
    </div>
  );
}
