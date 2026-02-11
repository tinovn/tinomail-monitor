import { useState } from "react";

type DataType = "email-events" | "server-metrics" | "blacklist-history" | "alert-history";
type ExportFormat = "csv" | "json";

export function DataExportFormPanel() {
  const [dataType, setDataType] = useState<DataType>("email-events");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [nodeId, setNodeId] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params: Record<string, string> = { format };
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      if (dataType === "server-metrics" && nodeId) params.nodeId = nodeId;

      const query = new URLSearchParams(params).toString();
      const url = `/api/v1/export/${dataType}?${query}`;

      // Trigger download
      window.open(url, "_blank");
    } catch (error) {
      alert("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="rounded-md border border-border bg-surface p-6">
      <h2 className="mb-6 text-lg font-semibold text-foreground">Export Data</h2>

      <div className="space-y-4">
        {/* Data Type Selection */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">Data Type</label>
          <select
            value={dataType}
            onChange={(e) => setDataType(e.target.value as DataType)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            <option value="email-events">Email Events</option>
            <option value="server-metrics">Server Metrics</option>
            <option value="blacklist-history">Blacklist History</option>
            <option value="alert-history">Alert History</option>
          </select>
        </div>

        {/* Format Selection */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </div>

        {/* Node Selection (for server metrics only) */}
        {dataType === "server-metrics" && (
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Node ID (optional)
            </label>
            <input
              type="text"
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              placeholder="Leave empty for all nodes"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
        )}

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </div>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isExporting ? "Exporting..." : "Export Data"}
        </button>
      </div>
    </div>
  );
}
