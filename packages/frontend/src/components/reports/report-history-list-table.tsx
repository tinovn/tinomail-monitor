import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { formatDistanceToNow } from "date-fns";

interface ReportHistoryEntry {
  id: string;
  type: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
}

export function ReportHistoryListTable() {
  const { data: reports = [], isLoading } = useQuery<ReportHistoryEntry[]>({
    queryKey: ["reports", "history"],
    queryFn: () => apiClient.get("/reports/history"),
  });

  const handleDownload = (reportId: string) => {
    const url = `/api/v1/reports/${reportId}/download`;
    window.open(url, "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-md border border-border bg-surface p-12">
        <p className="text-muted-foreground">Loading report history...</p>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-md border border-border bg-surface p-12">
        <p className="text-muted-foreground">No reports generated yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full table-dense">
          <thead>
            <tr className="">
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Type</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Period</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Generated</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              const typeColors: Record<string, string> = {
                daily: "bg-blue-500/10 text-blue-500 border-blue-500/20",
                weekly: "bg-green-500/10 text-green-500 border-green-500/20",
                monthly: "bg-purple-500/10 text-purple-500 border-purple-500/20",
              };

              return (
                <tr
                  key={report.id}
                  className="transition-colors hover:bg-surface/80"
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium capitalize ${
                        typeColors[report.type] || "bg-gray-500/10 text-gray-500 border-gray-500/20"
                      }`}
                    >
                      {report.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(report.periodStart).toLocaleDateString()} -{" "}
                    {new Date(report.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(report.generatedAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDownload(report.id)}
                      className="text-sm font-medium text-blue-500 hover:text-blue-600"
                    >
                      Download
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
