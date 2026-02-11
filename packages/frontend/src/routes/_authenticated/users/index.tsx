import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { MailUserListDataTable, type MailUserListItem } from "@/components/users/mail-user-list-data-table";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";

interface MailUsersResponse {
  users: MailUserListItem[];
  total: number;
  page: number;
  pageCount: number;
}

export const Route = createFileRoute("/_authenticated/users/")({
  component: UsersPage,
});

function UsersPage() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const page = 1;
  const autoRefresh = useTimeRangeStore((state) => state.autoRefresh);

  const { data, isLoading } = useQuery({
    queryKey: ["mail-users", page],
    queryFn: () =>
      apiClient.get<MailUsersResponse>("/mail-users", {
        page,
        limit: 20,
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const users = data?.users || [];
  const total = data?.total || 0;

  return (
    <div className="space-y-3">
      {isLoading ? (
        <LoadingSkeletonPlaceholder className="h-96" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-border bg-surface p-2">
              <div className="text-[11px] text-muted-foreground">Total Users</div>
              <div className="mt-1 text-lg font-mono-data font-bold text-foreground">
                {total.toLocaleString()}
              </div>
            </div>
            <div className="rounded-md border border-border bg-surface p-2">
              <div className="text-[11px] text-muted-foreground">Active (24h)</div>
              <div className="mt-1 text-lg font-mono-data font-bold text-status-ok">
                {users.filter((u) => u.sent24h > 0 || u.received24h > 0).length}
              </div>
            </div>
            <div className="rounded-md border border-border bg-surface p-2">
              <div className="text-[11px] text-muted-foreground">High Risk</div>
              <div className="mt-1 text-lg font-mono-data font-bold text-status-critical">
                {users.filter((u) => u.riskLevel === "High").length}
              </div>
            </div>
            <div className="rounded-md border border-border bg-surface p-2">
              <div className="text-[11px] text-muted-foreground">Spam Reports</div>
              <div className="mt-1 text-lg font-mono-data font-bold text-status-warning">
                {users.reduce((sum, u) => sum + u.spamReports, 0)}
              </div>
            </div>
          </div>

          <MailUserListDataTable
            users={users}
            sorting={sorting}
            onSortingChange={setSorting}
          />
        </>
      )}
    </div>
  );
}
