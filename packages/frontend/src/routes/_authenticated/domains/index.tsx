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

export const Route = createFileRoute("/_authenticated/domains/")({
  component: DomainsPage,
});

function DomainsPage() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const autoRefresh = useTimeRangeStore((state) => state.autoRefresh);

  const { data: domains, isLoading } = useQuery({
    queryKey: ["domains"],
    queryFn: () => apiClient.get<DomainWithHealthScore[]>("/domains"),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const avgHealthScore = domains
    ? Math.round(domains.reduce((sum, d) => sum + d.healthScore, 0) / domains.length)
    : 0;

  return (
    <div className="space-y-3">
      {isLoading || !domains ? (
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
                    {domains.length}
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
            onSortingChange={setSorting}
          />
        </>
      )}
    </div>
  );
}
