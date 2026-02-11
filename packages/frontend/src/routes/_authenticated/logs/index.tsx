import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LogSearchFilterBar } from "@/components/logs/log-search-filter-bar";
import { LogSearchResultsDataTable } from "@/components/logs/log-search-results-data-table";
import { LogSavedSearchManager } from "@/components/logs/log-saved-search-manager";

export const Route = createFileRoute("/_authenticated/logs/")({
  component: LogSearchPage,
});

export interface LogSearchFilters {
  eventType?: string[];
  fromAddress?: string;
  toAddress?: string;
  fromDomain?: string;
  toDomain?: string;
  mtaNode?: string;
  sendingIp?: string;
  messageId?: string;
  queueId?: string;
  statusCodeMin?: number;
  statusCodeMax?: number;
  bounceType?: string;
  searchText?: string;
}

function LogSearchPage() {
  const [filters, setFilters] = useState<LogSearchFilters>({});
  const [searchKey, setSearchKey] = useState(0);

  const handleSearch = (newFilters: LogSearchFilters) => {
    setFilters(newFilters);
    setSearchKey((prev) => prev + 1);
  };

  const handleLoadSavedSearch = (savedFilters: LogSearchFilters) => {
    setFilters(savedFilters);
    setSearchKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <LogSavedSearchManager
          currentFilters={filters}
          onLoadSearch={handleLoadSavedSearch}
        />
      </div>

      <LogSearchFilterBar onSearch={handleSearch} initialFilters={filters} />

      <div className="rounded-md border border-border bg-surface p-3">
        <LogSearchResultsDataTable filters={filters} searchKey={searchKey} />
      </div>
    </div>
  );
}
