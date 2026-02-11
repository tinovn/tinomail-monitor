# Phase 05 — Frontend Foundation (React App Shell)

## Context Links
- [Parent Plan](./plan.md)
- [PRD Section 21: UI/UX Requirements](../wildduck-dashboard-requirements.md)
- [Research: React Architecture](./research/researcher-02-frontend-database-agent.md)
- Depends on: [Phase 01](./phase-01-project-setup-and-infrastructure.md)

## Overview
- **Priority:** P1 (All UI features build on this)
- **Status:** pending
- **Effort:** 4-5 days
- **Description:** Build React 18 app skeleton with TanStack Router, shadcn/ui theme (dark/light), auth flow (login page, JWT storage, protected routes), app layout (sidebar + header + main), Zustand stores, React Query setup, Socket.IO client, ECharts provider. All subsequent phases add pages/components to this foundation.

## Key Insights
- TanStack Router for type-safe routing (research recommendation)
- shadcn/ui: composable, headless primitives. Init via CLI, customize per PRD color scheme
- Dark theme default (PRD 21.1): NOC monitoring screen optimized
- Zustand: separate stores for auth, theme, filters, time-range (no single god store)
- React Query v5: server state management, auto-refetch, optimistic updates
- Socket.IO client: connect with JWT, subscribe to rooms, update React Query cache
- ECharts: global dark/light theme registered once, used everywhere
- PRD Navigation: sidebar with 10 top-level items, nested sub-routes

## Requirements

### Functional
- Login page: username + password → JWT → redirect to dashboard
- Protected routes: redirect to /login if no valid JWT
- App layout: collapsible sidebar (PRD 21.2 nav structure), top header (user info, alerts badge, theme toggle, time range selector), main content area
- Theme: dark (default) + light, persisted in localStorage
- Time range selector: global, presets (1h, 6h, 24h, 7d, 30d) + custom range picker
- Auto-refresh: configurable (15s, 30s, 1m, 5m, off)
- Keyboard shortcuts: / = search, ? = help, R = refresh (PRD 21.1)
- Toast notifications: alerts appear bottom-right
- Full-screen mode: for NOC wall display

### Non-Functional
- Page load < 2s (code splitting per route)
- Smooth 60fps navigation transitions
- Accessibility: keyboard navigation, ARIA labels
- Responsive: optimized for 1920x1080+, minimum 1366x768

## Architecture

### Frontend Package Structure
```
packages/frontend/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── components.json              # shadcn/ui config
├── index.html
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx                 # React root: providers wrapper
│   ├── App.tsx                  # Router outlet
│   ├── styles/
│   │   └── globals.css          # Tailwind + PRD color tokens + dark/light
│   ├── lib/
│   │   ├── api-client.ts        # Fetch wrapper: base URL, JWT headers, error handling
│   │   ├── socket-client.ts     # Socket.IO singleton: connect, subscribe, events
│   │   ├── query-client.ts      # React Query client config
│   │   └── utils.ts             # cn() helper, formatters
│   ├── stores/
│   │   ├── auth-store.ts        # Zustand: user, tokens, login/logout actions
│   │   ├── theme-store.ts       # Zustand: dark/light, persist localStorage
│   │   ├── time-range-store.ts  # Zustand: selected range, auto-refresh interval
│   │   └── filter-store.ts      # Zustand: global filters (node, domain, IP)
│   ├── hooks/
│   │   ├── use-auth.ts          # Auth hook: login, logout, isAuthenticated
│   │   ├── use-socket.ts        # Socket.IO hook: subscribe/unsubscribe rooms
│   │   ├── use-time-range.ts    # Time range hook: range, setRange, formatted
│   │   └── use-keyboard.ts      # Keyboard shortcuts handler
│   ├── components/
│   │   ├── ui/                  # shadcn/ui primitives (auto-generated)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── table.tsx
│   │   │   ├── select.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   └── ... (more as needed)
│   │   ├── layout/
│   │   │   ├── app-layout.tsx       # Sidebar + header + main wrapper
│   │   │   ├── app-sidebar.tsx      # Sidebar nav per PRD 21.2
│   │   │   ├── app-header.tsx       # Top bar: breadcrumb, user, alerts, theme
│   │   │   ├── time-range-picker.tsx # Global time range + auto-refresh
│   │   │   └── breadcrumbs.tsx      # Auto breadcrumbs from route
│   │   ├── charts/
│   │   │   ├── echarts-provider.tsx  # ECharts theme registration
│   │   │   ├── base-chart.tsx        # Wrapper: loading, error, responsive
│   │   │   └── sparkline.tsx         # Mini inline chart
│   │   └── shared/
│   │       ├── status-dot.tsx        # Green/yellow/red status indicator
│   │       ├── data-table.tsx        # TanStack Table wrapper with virtual scroll
│   │       ├── loading-skeleton.tsx  # Content placeholder
│   │       ├── error-boundary.tsx    # React error boundary
│   │       └── empty-state.tsx       # No data placeholder
│   ├── routes/
│   │   ├── __root.tsx               # Root layout: providers, app-layout
│   │   ├── login.tsx                # /login (public)
│   │   ├── _authenticated.tsx       # Auth guard layout
│   │   ├── _authenticated/
│   │   │   ├── index.tsx            # / → Overview dashboard (Phase 06)
│   │   │   ├── servers/
│   │   │   │   ├── index.tsx        # /servers
│   │   │   │   └── $nodeId.tsx      # /servers/:nodeId
│   │   │   ├── email-flow/
│   │   │   │   └── index.tsx        # /email-flow
│   │   │   ├── domains/
│   │   │   │   ├── index.tsx        # /domains
│   │   │   │   └── $domain.tsx      # /domains/:domain
│   │   │   ├── users/
│   │   │   │   └── index.tsx        # /users
│   │   │   ├── ip-reputation/
│   │   │   │   ├── index.tsx        # /ip-reputation
│   │   │   │   └── $ip.tsx          # /ip-reputation/:ip
│   │   │   ├── spam-security/
│   │   │   │   └── index.tsx        # /spam-security
│   │   │   ├── logs/
│   │   │   │   └── index.tsx        # /logs
│   │   │   ├── alerts/
│   │   │   │   ├── index.tsx        # /alerts (active)
│   │   │   │   ├── history.tsx      # /alerts/history
│   │   │   │   └── rules.tsx        # /alerts/rules
│   │   │   ├── reports/
│   │   │   │   └── index.tsx        # /reports
│   │   │   └── settings/
│   │   │       └── index.tsx        # /settings
│   │   └── routeTree.gen.ts         # Auto-generated by TanStack Router
│   └── types/
│       └── index.ts                 # Re-export from @tinomail/shared
```

### Provider Stack (main.tsx)
```
<React.StrictMode>
  <ThemeProvider>            ← dark/light CSS class on <html>
    <QueryClientProvider>    ← React Query v5
      <SocketProvider>       ← Socket.IO connection manager
        <RouterProvider>     ← TanStack Router
          <Toaster />        ← shadcn toast notifications
        </RouterProvider>
      </SocketProvider>
    </QueryClientProvider>
  </ThemeProvider>
</React.StrictMode>
```

## Related Code Files

### Files to Create
- `packages/frontend/src/main.tsx`
- `packages/frontend/src/App.tsx`
- `packages/frontend/src/styles/globals.css`
- `packages/frontend/src/lib/*.ts` (4 files)
- `packages/frontend/src/stores/*.ts` (4 stores)
- `packages/frontend/src/hooks/*.ts` (4 hooks)
- `packages/frontend/src/components/layout/*.tsx` (5 components)
- `packages/frontend/src/components/charts/*.tsx` (3 components)
- `packages/frontend/src/components/shared/*.tsx` (5 components)
- `packages/frontend/src/routes/*.tsx` (route stubs, ~15 files)
- shadcn/ui components via CLI (10+ primitives)

## Implementation Steps

### Step 1: Vite + Tailwind + shadcn/ui Init
1. Configure `vite.config.ts`: proxy `/api` to `http://localhost:3001`, proxy `/ws` to WS
2. Install Tailwind v4 + `@tailwindcss/vite` plugin
3. Configure `globals.css` with PRD color scheme (Section 21.4):
   ```css
   :root {
     --background: 222.2 84% 4.9%;      /* slate-900: #0f172a */
     --foreground: 210 40% 98%;          /* slate-200: #e2e8f0 */
     --card: 217.2 32.6% 17.5%;         /* slate-800: #1e293b */
     --muted-foreground: 215 20.2% 65.1%; /* slate-400: #94a3b8 */
     --ok: 142.1 76.2% 36.3%;           /* green-500: #22c55e */
     --warning: 47.9 95.8% 53.1%;       /* yellow-500: #eab308 */
     --critical: 0 84.2% 60.2%;         /* red-500: #ef4444 */
     --info: 217.2 91.2% 59.8%;         /* blue-500: #3b82f6 */
   }
   ```
4. Init shadcn/ui: `npx shadcn@latest init` — select dark theme default, slate color
5. Add components: button, card, sidebar, table, select, badge, toast, dialog, dropdown-menu, input, label, separator

### Step 2: TanStack Router Setup
1. Install `@tanstack/react-router`, `@tanstack/react-router-devtools`, `@tanstack/router-vite-plugin`
2. Add TanStack Router Vite plugin for auto route generation
3. Create file-based routes in `src/routes/`
4. `__root.tsx`: wraps everything in app layout
5. `_authenticated.tsx`: auth guard — checks JWT, redirects to /login
6. Create stub route files for all sidebar items (just render `<div>Page Name - Coming Soon</div>`)

### Step 3: Auth Flow
1. `auth-store.ts`: Zustand store with `user`, `accessToken`, `refreshToken`, `login()`, `logout()`, `isAuthenticated`
2. Persist tokens in `localStorage` (with refresh token rotation)
3. `login.tsx` route: form with username + password, call `POST /auth/login`, store tokens, redirect to `/`
4. `api-client.ts`: attach Bearer token to all requests, intercept 401 → attempt refresh → retry or redirect to /login
5. `_authenticated.tsx`: check auth store, redirect if no token

### Step 4: App Layout
1. `app-layout.tsx`: flex container — sidebar (collapsible, 240px/64px) + main area (header + content)
2. `app-sidebar.tsx`: render PRD 21.2 navigation structure
   - Icons from lucide-react
   - Active state highlighting
   - Collapsible sections (Servers, Email Flow, IP Reputation, etc.)
   - Bottom: theme toggle, user menu
3. `app-header.tsx`: breadcrumbs (auto from route), right side: time range picker, auto-refresh toggle, alerts badge (count), user dropdown
4. `time-range-picker.tsx`: dropdown with presets (1h, 6h, 24h, 7d, 30d) + custom date range picker + auto-refresh (15s, 30s, 1m, 5m, off)

### Step 5: Zustand Stores
1. `auth-store.ts` — user state + token management (Step 3)
2. `theme-store.ts` — `theme: 'dark' | 'light'`, toggle function, persist to localStorage, apply class to `<html>`
3. `time-range-store.ts` — `range: '1h'|'6h'|'24h'|'7d'|'30d'|{from,to}`, `autoRefresh: number|null`, `timezone: string`
4. `filter-store.ts` — `selectedNodes: string[]`, `selectedDomain: string|null`, `selectedIp: string|null`

### Step 6: React Query + Socket.IO
1. `query-client.ts`: configure staleTime (30s for metrics, 5min for config), gcTime, retry logic
2. `socket-client.ts`: Socket.IO singleton
   - Connect with JWT auth: `io(url, { auth: { token } })`
   - Subscribe to rooms: `socket.emit('subscribe', { channels: ['metrics','alerts'] })`
   - On `metrics:system` event: update React Query cache for that node
   - On `alert:fired` event: show toast + update alert badge count
   - Auto-reconnect on token refresh
3. `use-socket.ts` hook: subscribe/unsubscribe to rooms on mount/unmount

### Step 7: ECharts Provider
1. Register dark + light ECharts themes globally
2. Dark theme colors matching PRD color scheme
3. `base-chart.tsx`: wrapper handling loading state, error state, resize, theme
4. `sparkline.tsx`: tiny inline chart component for tables/cards

### Step 8: Shared Components
1. `status-dot.tsx`: green/yellow/red circle (used everywhere for node/IP/service status)
2. `data-table.tsx`: TanStack Table wrapper with virtual scroll, sorting, filtering, pagination, column visibility. Reusable for IPs, nodes, domains, users, logs tables
3. `loading-skeleton.tsx`: content placeholder during data fetch
4. `error-boundary.tsx`: catch React errors, show retry button
5. `empty-state.tsx`: "No data found" with optional action button

### Step 9: Keyboard Shortcuts
1. `use-keyboard.ts`: register global handlers
   - `/` → focus search input
   - `?` → open help modal
   - `R` → trigger refresh
   - `Escape` → close modals
2. Help modal listing all shortcuts

## Todo List
- [ ] Configure Vite (proxy, plugins)
- [ ] Set up Tailwind v4 with PRD color tokens
- [ ] Init shadcn/ui, add 10+ base components
- [ ] Set up TanStack Router with file-based routes
- [ ] Create all route stubs (15 pages)
- [ ] Implement auth store + login page
- [ ] Implement API client with JWT interceptor
- [ ] Implement auth guard (_authenticated layout)
- [ ] Build app sidebar (PRD nav structure)
- [ ] Build app header (breadcrumbs, time range, alerts badge)
- [ ] Build time range picker (presets + custom + auto-refresh)
- [ ] Implement theme store + toggle (dark/light)
- [ ] Set up React Query client
- [ ] Set up Socket.IO client with auth
- [ ] Register ECharts themes + base chart wrapper
- [ ] Build data-table component (TanStack Table + virtual scroll)
- [ ] Build shared components (status-dot, loading, error, empty)
- [ ] Implement keyboard shortcuts
- [ ] Verify: login → redirect to dashboard → sidebar nav works
- [ ] Verify: dark/light theme toggle works
- [ ] Verify: time range selector persists across pages

## Success Criteria
- Login flow works end-to-end (login → store JWT → redirect → protected routes)
- Sidebar navigation renders all PRD menu items, active state works
- Dark/light theme toggles correctly, persists across refresh
- Time range selector visible and functional on all pages
- Auto-refresh toggles work (15s/30s/1m/5m/off)
- Socket.IO connects with JWT, subscribes to rooms
- All route stubs render without errors
- data-table component renders 1000 dummy rows with virtual scroll at 60fps
- Page loads in < 2s (measure with Lighthouse)

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| TanStack Router learning curve | Med | Start with simple routes, add type-safe params incrementally |
| shadcn/ui + Tailwind v4 compatibility | Low | Pin versions, test during setup |
| ECharts bundle size (200KB) | Med | Tree-shake unused chart types, lazy load |
| Socket.IO reconnection loop | Med | Exponential backoff, max retry limit |

## Security Considerations
- JWT stored in localStorage (acceptable for internal tool; httpOnly cookie alternative if needed)
- Refresh token rotation prevents token theft
- CORS restricted to frontend origin
- No PII displayed without auth

## Next Steps
- Phase 06: Build Overview Dashboard + Server Monitoring using this shell
- All subsequent phases add routes/pages to this foundation
