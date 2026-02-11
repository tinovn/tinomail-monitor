import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";

interface RspamdSummary {
  totalScanned: number;
  totalHam: number;
  totalSpam: number;
  totalGreylist: number;
  totalRejected: number;
  totalLearnedHam: number;
  totalLearnedSpam: number;
}

export function RspamdLearningProgressCards() {
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
    return <LoadingSkeletonPlaceholder className="h-40" />;
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-lg border border-border bg-green-500/10 p-6">
        <div className="text-sm font-medium text-muted-foreground">Learned Ham</div>
        <div className="mt-2 text-3xl font-bold text-green-500">
          {(data.totalLearnedHam ?? 0).toLocaleString()}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">Clean messages trained</div>
      </div>

      <div className="rounded-lg border border-border bg-red-500/10 p-6">
        <div className="text-sm font-medium text-muted-foreground">Learned Spam</div>
        <div className="mt-2 text-3xl font-bold text-red-500">
          {(data.totalLearnedSpam ?? 0).toLocaleString()}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">Spam messages trained</div>
      </div>
    </div>
  );
}
