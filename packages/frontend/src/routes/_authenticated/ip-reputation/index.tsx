import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { apiClient } from "@/lib/api-http-client";
import { IpReputationSummaryBar } from "@/components/ip-reputation/ip-reputation-summary-bar";
import { BlacklistedIpsDataTable } from "@/components/ip-reputation/blacklisted-ips-data-table";
import { IpStatusHeatmapChart } from "@/components/ip-reputation/ip-status-heatmap-chart";

export const Route = createFileRoute("/_authenticated/ip-reputation/")({
  component: IpReputationPage,
});

interface BlacklistedIp {
  ip: string;
  ipVersion: number;
  nodeId: string | null;
  blacklists: Array<{
    blacklist: string;
    tier: string;
    listed: boolean;
    lastChecked: string;
  }>;
  highestTier: string;
  consecutiveChecks: number;
  status: string;
}

function IpReputationPage() {
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data: blacklistedIps, isLoading } = useQuery({
    queryKey: ["ip-reputation", "blacklisted"],
    queryFn: () => apiClient.get<BlacklistedIp[]>("/ip-reputation/blacklisted"),
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-3">
      <IpReputationSummaryBar />

      <div className="rounded-md border border-border bg-surface p-3">
        <IpStatusHeatmapChart />
      </div>

      <div className="rounded-md border border-border bg-surface p-3">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : (
          <BlacklistedIpsDataTable
            data={blacklistedIps || []}
            sorting={sorting}
            onSortingChange={setSorting}
          />
        )}
      </div>
    </div>
  );
}
