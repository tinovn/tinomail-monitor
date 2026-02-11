import { useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { cn } from "@/lib/classname-utils";
import type { LogSearchFilters } from "@/routes/_authenticated/logs/index";

interface LogSearchFilterBarProps {
  onSearch: (filters: LogSearchFilters) => void;
  initialFilters?: LogSearchFilters;
}

export function LogSearchFilterBar({ onSearch, initialFilters = {} }: LogSearchFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<LogSearchFilters>(initialFilters);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  };

  const handleReset = () => {
    setFilters({});
    onSearch({});
  };

  const eventTypeOptions = [
    "queued",
    "deferred",
    "delivered",
    "bounced",
    "rejected",
    "transferred",
  ];

  return (
    <div className="rounded-md border border-border bg-surface p-6">
      <form onSubmit={handleSubmit}>
        {/* Main Search Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search message ID, queue ID, email addresses..."
              value={filters.searchText || ""}
              onChange={(e) => setFilters({ ...filters, searchText: e.target.value })}
              className="w-full rounded-md border border-border bg-background py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Filters
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            type="submit"
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Search
          </button>
        </div>

        {/* Expanded Filter Panel */}
        <div
          className={cn(
            "mt-4 grid gap-4 overflow-hidden transition-all duration-200",
            isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Event Type */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Event Type
                </label>
                <select
                  multiple
                  value={filters.eventType || []}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      eventType: Array.from(e.target.selectedOptions, (option) => option.value),
                    })
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  size={3}
                >
                  {eventTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* From Address */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  From Address
                </label>
                <input
                  type="text"
                  value={filters.fromAddress || ""}
                  onChange={(e) => setFilters({ ...filters, fromAddress: e.target.value })}
                  placeholder="sender@example.com"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* To Address */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  To Address
                </label>
                <input
                  type="text"
                  value={filters.toAddress || ""}
                  onChange={(e) => setFilters({ ...filters, toAddress: e.target.value })}
                  placeholder="recipient@example.com"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* From Domain */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  From Domain
                </label>
                <input
                  type="text"
                  value={filters.fromDomain || ""}
                  onChange={(e) => setFilters({ ...filters, fromDomain: e.target.value })}
                  placeholder="example.com"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* To Domain */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  To Domain
                </label>
                <input
                  type="text"
                  value={filters.toDomain || ""}
                  onChange={(e) => setFilters({ ...filters, toDomain: e.target.value })}
                  placeholder="example.com"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* MTA Node */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  MTA Node
                </label>
                <input
                  type="text"
                  value={filters.mtaNode || ""}
                  onChange={(e) => setFilters({ ...filters, mtaNode: e.target.value })}
                  placeholder="mta-01"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Sending IP */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Sending IP
                </label>
                <input
                  type="text"
                  value={filters.sendingIp || ""}
                  onChange={(e) => setFilters({ ...filters, sendingIp: e.target.value })}
                  placeholder="1.2.3.4"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Message ID */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Message ID
                </label>
                <input
                  type="text"
                  value={filters.messageId || ""}
                  onChange={(e) => setFilters({ ...filters, messageId: e.target.value })}
                  placeholder="msg-123..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Queue ID */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Queue ID
                </label>
                <input
                  type="text"
                  value={filters.queueId || ""}
                  onChange={(e) => setFilters({ ...filters, queueId: e.target.value })}
                  placeholder="queue-456..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
