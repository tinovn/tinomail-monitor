import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";
import { formatDistanceToNow } from "date-fns";

interface FailedIpRecord {
  sourceIp: string;
  failCount: number;
  lastAttempt: string;
}

export function AuthFailedByIpDataTable() {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data, isLoading } = useQuery({
    queryKey: ["security", "auth", "failed-ips", from, to],
    queryFn: () =>
      apiClient.get<FailedIpRecord[]>("/security/auth/failed-ips", {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  if (isLoading) {
    return <LoadingSkeletonPlaceholder className="h-64" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-muted/20 p-12">
        <p className="text-sm text-muted-foreground">No failed login attempts</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-dense">
        <thead>
          <tr className="">
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              Source IP
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              Failed Attempts
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              Last Attempt
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.sourceIp} className="hover:bg-muted/20">
              <td className="px-4 py-3 font-mono text-sm text-foreground">
                {row.sourceIp}
              </td>
              <td className="px-4 py-3 text-sm">
                <span className="rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-400">
                  {row.failCount} failed
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(row.lastAttempt), { addSuffix: true })}
              </td>
              <td className="px-4 py-3 text-right">
                <button className="rounded-md bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20">
                  Block IP
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
