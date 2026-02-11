import { Search } from "lucide-react";
import { cn } from "@/lib/classname-utils";
import { StatusIndicatorDot } from "./status-indicator-dot";

type StatusType = "ok" | "warning" | "critical" | "muted";

interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface StatusFilterItem {
  id: string;
  label: string;
  status: StatusType;
}

interface FilterToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  tabs?: TabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  statusFilters?: StatusFilterItem[];
  activeStatusFilter?: string;
  onStatusFilterChange?: (id: string) => void;
  rightSlot?: React.ReactNode;
}

export function FilterToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search or filter...",
  tabs,
  activeTab,
  onTabChange,
  statusFilters,
  activeStatusFilter,
  onStatusFilterChange,
  rightSlot,
}: FilterToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border pb-2">
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-8 rounded-md border border-border bg-surface pl-7 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
        />
      </div>

      {/* Tab filters */}
      {tabs && onTabChange && (
        <div className="flex items-center rounded-md border border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.count != null && (
                <span className="ml-1 opacity-70">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Status filters */}
      {statusFilters && onStatusFilterChange && (
        <div className="flex items-center gap-1">
          {statusFilters.map((sf) => (
            <button
              key={sf.id}
              onClick={() => onStatusFilterChange(sf.id)}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
                activeStatusFilter === sf.id
                  ? "bg-surface-elevated text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <StatusIndicatorDot status={sf.status} size="sm" />
              {sf.label}
            </button>
          ))}
        </div>
      )}

      {/* Right slot */}
      {rightSlot && <div className="ml-auto flex items-center gap-2">{rightSlot}</div>}
    </div>
  );
}
