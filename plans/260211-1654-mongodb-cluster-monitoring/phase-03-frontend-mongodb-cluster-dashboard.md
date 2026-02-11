# Phase 3: Frontend MongoDB Cluster Dashboard

## Context Links
- Parent: [plan.md](plan.md)
- Depends on: Phase 2 (backend API must be fixed first)
- PRD: Section 7.3 (Overview Dashboard — MongoDB Cluster Panel)
- Sidebar: [app-sidebar-navigation.tsx](../../packages/frontend/src/components/layout/app-sidebar-navigation.tsx)
- Chart wrapper: [echarts-base-wrapper.tsx](../../packages/frontend/src/components/charts/echarts-base-wrapper.tsx)
- Page pattern: [servers/zonemta/index.tsx](../../packages/frontend/src/routes/_authenticated/servers/zonemta/index.tsx)

## Overview
- **Priority**: P1
- **Status**: pending
- **Description**: Create MongoDB cluster overview page at `/servers/mongodb/` with replica set status panel, time-series charts (repl lag, ops/sec, connections), gauge charts (WiredTiger cache), and database size visualization.

## Key Insights

### Existing Patterns
- **Sidebar**: flat `navItems` array in `app-sidebar-navigation.tsx` — add entry between "Servers" and "Email Flow"
- **Pages**: TanStack Router file-based routing under `routes/_authenticated/`
- **Data fetching**: `useQuery` from TanStack Query + `apiClient.get()` + `useTimeRangeStore()` for time range
- **Charts**: `EchartsBaseWrapper` component with dark theme built-in (oklch colors)
- **Chart pattern**: each chart is its own file, accepts `nodeId` or data prop, handles its own query
- **Shared components**: `LoadingSkeletonPlaceholder`, `EmptyStatePlaceholder`, `FilterToolbar`
- **Auto-refresh**: `autoRefresh` from `useTimeRangeStore` controls `refetchInterval`

### Design
- Dark theme (NOC monitoring screens)
- Top section: Replica Set Status panel (3 node cards with role badges)
- Middle: 2-column grid of time-series charts
- Bottom: Database sizes + WiredTiger cache gauges

## Requirements

### Functional
- MongoDB Cluster overview page at `/servers/mongodb/`
- Sidebar nav entry with Database icon
- Replica set status panel showing all nodes with role/status/lag
- Replication lag time-series chart (line, per node)
- Operations/sec stacked area chart (insert/query/update/delete/command)
- Connections chart (current vs available per node)
- WiredTiger cache gauge (used vs max)
- Database sizes bar chart (data/index/storage)
- Oplog window display
- Auto-refresh support via global time range store

### Non-Functional
- Each component file < 200 lines
- Responsive layout (2-col → 1-col on mobile)
- Dark theme consistent with existing charts

## Architecture

```
/servers/mongodb/  (route page)
└── MongodbClusterOverviewPage
    ├── ReplicaSetStatusPanel  ← GET /api/v1/mongodb/cluster-status
    ├── Grid (2 columns)
    │   ├── ReplicationLagTimeseriesChart  ← GET /api/v1/metrics/mongodb
    │   ├── OpsPerSecStackedAreaChart      ← GET /api/v1/metrics/mongodb
    │   ├── ConnectionsPerNodeBarChart     ← GET /api/v1/mongodb/cluster-status
    │   └── WiredtigerCacheGaugeChart      ← GET /api/v1/mongodb/cluster-status
    └── Grid (2 columns)
        ├── DatabaseSizeComparisonBarChart ← GET /api/v1/mongodb/cluster-status
        └── OplogWindowStatusDisplay       ← GET /api/v1/mongodb/cluster-status
```

## Related Code Files

### Modify
- `packages/frontend/src/components/layout/app-sidebar-navigation.tsx` — add MongoDB nav entry

### Create
- `packages/frontend/src/routes/_authenticated/servers/mongodb/index.tsx` — page route
- `packages/frontend/src/components/mongodb/replica-set-status-panel.tsx`
- `packages/frontend/src/components/mongodb/replication-lag-timeseries-chart.tsx`
- `packages/frontend/src/components/mongodb/ops-per-sec-stacked-area-chart.tsx`
- `packages/frontend/src/components/mongodb/connections-per-node-bar-chart.tsx`
- `packages/frontend/src/components/mongodb/wiredtiger-cache-gauge-chart.tsx`
- `packages/frontend/src/components/mongodb/database-size-comparison-bar-chart.tsx`
- `packages/frontend/src/components/mongodb/oplog-window-status-display.tsx`

## Implementation Steps

### Step 1: Add Sidebar Navigation Entry
File: `packages/frontend/src/components/layout/app-sidebar-navigation.tsx`

Add after "Servers" entry:
```typescript
{ id: "mongodb", label: "MongoDB", icon: Database, to: "/servers/mongodb" },
```
Import `Database` from lucide-react.

### Step 2: Create Route Page
File: `packages/frontend/src/routes/_authenticated/servers/mongodb/index.tsx`

Pattern from ZoneMTA overview:
- `createFileRoute("/_authenticated/servers/mongodb/")`
- Fetch cluster status with `useQuery({ queryKey: ["mongodb", "cluster-status"] })`
- Layout: title + status panel + chart grid
- Pass cluster data to child components

### Step 3: Replica Set Status Panel
File: `packages/frontend/src/components/mongodb/replica-set-status-panel.tsx`

- 3 cards in a row (one per node)
- Each card: node ID, role badge (PRIMARY=green, SECONDARY=blue), repl lag, connections, ops/sec
- Role badge uses shadcn Badge component
- Highlight critical: repl lag > 10s = yellow, > 30s = red

### Step 4: Replication Lag Chart
File: `packages/frontend/src/components/mongodb/replication-lag-timeseries-chart.tsx`

- ECharts line chart via `EchartsBaseWrapper`
- X: time axis, Y: seconds
- One line per node (legend)
- Query: `GET /api/v1/metrics/mongodb?from=&to=` — filter for repl_lag_seconds
- Warning threshold line at 10s (dashed yellow), critical at 30s (dashed red)

### Step 5: Ops/Sec Chart
File: `packages/frontend/src/components/mongodb/ops-per-sec-stacked-area-chart.tsx`

- ECharts stacked area chart
- 5 series: insert, query, update, delete, command
- Uses rate calculation (delta between consecutive data points / time diff)
- Or display cumulative totals if rate calc is complex — simpler first pass

### Step 6: Connections Chart
File: `packages/frontend/src/components/mongodb/connections-per-node-bar-chart.tsx`

- ECharts horizontal bar chart from cluster-status data
- Each node: bar showing current vs available connections
- Color: current=blue, available=gray background

### Step 7: WiredTiger Cache Gauge
File: `packages/frontend/src/components/mongodb/wiredtiger-cache-gauge-chart.tsx`

- ECharts gauge chart per node (or single gauge for PRIMARY)
- Shows `wt_cache_used_bytes / wt_cache_max_bytes` as percentage
- Color zones: 0-70% green, 70-90% yellow, 90-100% red

### Step 8: Database Size Chart
File: `packages/frontend/src/components/mongodb/database-size-comparison-bar-chart.tsx`

- ECharts grouped bar chart
- Groups: data, index, storage
- From PRIMARY node's cluster-status data
- Format bytes to human-readable (GB/TB)

### Step 9: Oplog Window Display
File: `packages/frontend/src/components/mongodb/oplog-window-status-display.tsx`

- Simple card component (not a chart)
- Shows oplog window in hours from PRIMARY node
- Color: > 48h = green, 24-48h = yellow, < 24h = red
- Small text explaining what oplog window means

## Todo List
- [ ] Add MongoDB sidebar nav entry with Database icon
- [ ] Create mongodb route page
- [ ] Create replica-set-status-panel
- [ ] Create replication-lag-timeseries-chart
- [ ] Create ops-per-sec-stacked-area-chart
- [ ] Create connections-per-node-bar-chart
- [ ] Create wiredtiger-cache-gauge-chart
- [ ] Create database-size-comparison-bar-chart
- [ ] Create oplog-window-status-display
- [ ] Verify all components < 200 lines
- [ ] Test with seed data

## Success Criteria
- `/servers/mongodb/` page loads and shows all components
- Sidebar highlights "MongoDB" when on the page
- Charts render with seed data
- Auto-refresh works via time range store
- Responsive layout on mobile
- Dark theme consistent with existing pages

## Risk Assessment
- **No real data**: until agent collector is deployed, only seed data available — acceptable for development
- **Rate calculation**: ops/sec from cumulative counters requires delta math — may defer to backend
- **Empty state**: if no MongoDB nodes registered, show `EmptyStatePlaceholder`

## Security Considerations
- All API calls use JWT auth (handled by authenticated route layout)
- No sensitive data displayed (metrics only)
