import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { ReportSummaryStatCards } from "./report-summary-stat-cards";

interface DailyReportData {
  totalSent: number;
  bounceRate: number;
  deliveredPercent: number;
  clusterHealth: "healthy" | "degraded" | "critical";
  activeAlerts: number;
  topIssues: Array<{ issue: string; count: number }>;
  clusterHealthSummary: string;
}

interface ReportDailyDetailPanelProps {
  reportType: "daily" | "weekly" | "monthly" | "ip-reputation";
}

export function ReportDailyDetailPanel({ reportType }: ReportDailyDetailPanelProps) {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  const queryKey = reportType === "ip-reputation"
    ? ["reports", "ip-reputation"]
    : ["reports", reportType, selectedDate];

  const { data: reportData, isLoading } = useQuery<DailyReportData>({
    queryKey,
    queryFn: () => {
      if (reportType === "ip-reputation") {
        return apiClient.get("/reports/ip-reputation");
      }
      const params: Record<string, string> = {};
      if (reportType === "daily") params.date = selectedDate;
      if (reportType === "weekly") params.week = selectedDate;
      if (reportType === "monthly") params.month = selectedDate;
      return apiClient.get(`/reports/${reportType}`, params);
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => apiClient.post("/reports/generate", { type: reportType }),
    onSuccess: () => {
      alert("Report generation started");
    },
  });

  const stats = reportData
    ? {
        totalSent: reportData.totalSent,
        bounceRate: reportData.bounceRate,
        deliveredPercent: reportData.deliveredPercent,
        clusterHealth: reportData.clusterHealth,
        activeAlerts: reportData.activeAlerts,
      }
    : {
        totalSent: 0,
        bounceRate: 0,
        deliveredPercent: 0,
        clusterHealth: "healthy" as const,
        activeAlerts: 0,
      };

  return (
    <div className="space-y-6">
      {/* Date Picker & Generate Button */}
      {reportType !== "ip-reputation" && (
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {generateMutation.isPending ? "Generating..." : "Generate Report"}
          </button>
        </div>
      )}

      {/* Summary Stats */}
      <ReportSummaryStatCards stats={stats} isLoading={isLoading} />

      {/* Top Issues */}
      {reportData?.topIssues && reportData.topIssues.length > 0 && (
        <div className="rounded-md border border-border bg-surface p-4">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Top Issues</h3>
          <div className="space-y-2">
            {reportData.topIssues.map((issue, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{issue.issue}</span>
                <span className="text-sm font-medium text-foreground">{issue.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cluster Health Summary */}
      {reportData?.clusterHealthSummary && (
        <div className="rounded-md border border-border bg-surface p-4">
          <h3 className="mb-2 text-lg font-semibold text-foreground">Cluster Health Summary</h3>
          <p className="text-sm text-muted-foreground">{reportData.clusterHealthSummary}</p>
        </div>
      )}
    </div>
  );
}
