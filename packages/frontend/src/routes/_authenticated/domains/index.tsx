import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import type { SendingDomain } from "@tinomail/shared";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { DomainHealthScoreTable } from "@/components/domains/domain-health-score-table";
import { DomainHealthScoreGaugeChart } from "@/components/domains/domain-health-score-gauge-chart";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";

interface DomainWithHealthScore extends SendingDomain {
  healthScore: number;
  sent24h: number;
  deliveredPercent: number;
  bouncePercent: number;
}

interface DomainsResponse {
  domains: DomainWithHealthScore[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export const Route = createFileRoute("/_authenticated/domains/")({
  component: DomainsPage,
});

function DomainsPage() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const autoRefresh = useTimeRangeStore((state) => state.autoRefresh);
  const limit = 50;

  // Build query params for server
  const sortBy = sorting[0]?.id as string | undefined;
  const sortOrder = sorting[0] ? (sorting[0].desc ? "desc" : "asc") : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["domains", page, limit, search, sortBy, sortOrder],
    queryFn: () => {
      const params: Record<string, string | number> = { page, limit };
      if (search) params.search = search;
      if (sortBy) params.sortBy = sortBy;
      if (sortOrder) params.sortOrder = sortOrder;
      return apiClient.get<DomainsResponse>("/domains", params);
    },
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const domains = data?.domains ?? [];
  const pagination = data?.pagination;

  const avgHealthScore = domains.length
    ? Math.round(domains.reduce((sum, d) => sum + d.healthScore, 0) / domains.length)
    : 0;

  // Reset page when search changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleSortingChange = (updater: SortingState | ((old: SortingState) => SortingState)) => {
    setSorting(updater);
    setPage(1);
  };

  return (
    <div className="space-y-3">
      {isLoading || !data ? (
        <LoadingSkeletonPlaceholder className="h-96" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <div className="lg:col-span-1">
              <DomainHealthScoreGaugeChart
                score={avgHealthScore}
                title="Average Health Score"
              />
            </div>
            <div className="lg:col-span-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border border-border bg-surface p-3">
                  <div className="text-[11px] text-muted-foreground">Total Domains</div>
                  <div className="mt-1 text-lg font-mono-data font-bold text-foreground">
                    {pagination?.total ?? 0}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-surface p-3">
                  <div className="text-[11px] text-muted-foreground">Healthy Domains</div>
                  <div className="mt-1 text-lg font-mono-data font-bold text-status-ok">
                    {domains.filter((d) => d.healthScore >= 90).length}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-surface p-3">
                  <div className="text-[11px] text-muted-foreground">At Risk</div>
                  <div className="mt-1 text-lg font-mono-data font-bold text-status-critical">
                    {domains.filter((d) => d.healthScore < 70).length}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DomainHealthScoreTable
            domains={domains}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            search={search}
            onSearchChange={handleSearchChange}
            pagination={pagination}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
