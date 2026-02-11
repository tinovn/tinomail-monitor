# Phase 13 — Reports, Admin Panel & Polish (PRD Modules 12+13)

## Context Links
- [Parent Plan](./plan.md)
- [PRD Section 18: Reports & Export](../wildduck-dashboard-requirements.md)
- [PRD Section 19: Admin & Configuration](../wildduck-dashboard-requirements.md)
- Depends on: all previous phases (reports aggregate data from all modules)

## Overview
- **Priority:** P2 (Enhancement layer — system functional without this)
- **Status:** pending
- **Effort:** 5-7 days
- **Description:** Build scheduled reports (daily/weekly/monthly with PDF generation), data export (CSV, JSON, XLSX), admin panel (node management, IP management, user management, settings), audit log, and overall polish (performance optimization, mobile responsive, documentation).

## Key Insights
- PDF generation: use `puppeteer` to render HTML template → PDF (or `pdfkit` for simpler reports)
- Report scheduling: BullMQ cron jobs (daily @8AM, weekly @Monday 9AM, monthly @1st)
- Data export: stream large datasets as CSV to avoid memory issues
- Admin panel: RBAC enforced (admin-only for user management, operator for node/IP)
- Polish: lazy-load routes, optimize ECharts bundle, add service worker for offline status page

## Requirements

### Functional (Reports — PRD 18)
- **Scheduled reports:** daily summary (8AM), weekly report (Monday 9AM), monthly report (1st), IP reputation report (daily)
- **Report content:** emails sent/received, bounce rate, top issues, cluster health, trends, IP status, incidents, recommendations
- **Format:** PDF auto-emailed to admin team
- **On-demand export:** email events (CSV/JSON/XLSX), server metrics (CSV), blacklist history (CSV), alert history (CSV), domain stats (CSV/PDF), user stats (CSV/PDF)
- **API export:** REST endpoints for external tool integration

### Functional (Admin — PRD 19)
- **Node management:** register (manual), edit node info, decommission, maintenance mode
- **IP management:** add IP range (CIDR), bulk status change, warmup schedule templates, import/export CSV
- **User management (dashboard users):** CRUD, roles (admin/operator/viewer), optional 2FA (TOTP), API token generation
- **Settings:** data retention config, collection intervals, DNSBL list, timezone, theme default, alert defaults
- **Audit log:** who did what when (all admin/operator actions logged)

### Non-Functional
- PDF generation: < 30s for daily report
- CSV export: stream large datasets (100K+ rows) without memory spike
- Settings changes take effect immediately (no restart required)

## Architecture

### Backend New Files
```
packages/backend/src/
├── workers/
│   ├── report-generation-worker.ts    # BullMQ: scheduled report generation
│   └── export-worker.ts              # BullMQ: async large export jobs
├── services/
│   ├── report-service.ts             # Report data aggregation
│   ├── pdf-service.ts                # HTML → PDF via puppeteer
│   ├── export-service.ts             # CSV/JSON/XLSX streaming
│   └── audit-service.ts              # Audit log writer
├── routes/
│   ├── reports/
│   │   ├── daily.ts                  # GET /reports/daily?date=
│   │   ├── weekly.ts                 # GET /reports/weekly?week=
│   │   ├── generate.ts              # POST /reports/generate (trigger manual)
│   │   ├── export.ts                 # GET /reports/export?type=csv&...
│   │   └── index.ts
│   ├── admin/
│   │   ├── users.ts                  # CRUD /admin/users (dashboard users)
│   │   ├── settings.ts               # GET/PUT /admin/settings
│   │   ├── audit-log.ts              # GET /admin/audit-log
│   │   ├── api-tokens.ts             # CRUD /admin/api-tokens
│   │   └── index.ts
├── templates/
│   ├── report-daily.html             # HTML template for daily PDF
│   ├── report-weekly.html
│   └── report-monthly.html
```

### Frontend New Files
```
src/routes/_authenticated/
├── reports/
│   └── index.tsx                     # Reports page (schedule, on-demand, history)
├── settings/
│   ├── index.tsx                     # Settings overview
│   ├── nodes.tsx                     # Node management
│   ├── ip-management.tsx             # IP admin
│   ├── users.tsx                     # Dashboard user management
│   └── configuration.tsx             # System settings

src/components/reports/
├── scheduled-reports-table.tsx       # Report schedule + history
├── export-form.tsx                   # On-demand export with format/filter selection
├── report-preview.tsx                # Preview report data before PDF

src/components/settings/
├── node-management-table.tsx         # Admin: register, edit, decommission nodes
├── ip-admin-panel.tsx                # Admin: add range, bulk ops, import/export
├── user-management-table.tsx         # Admin: CRUD dashboard users
├── role-assignment-form.tsx          # Assign roles to users
├── two-factor-setup.tsx              # 2FA TOTP setup flow
├── api-token-manager.tsx             # Generate/revoke API tokens
├── settings-form.tsx                 # General settings form
├── data-retention-config.tsx         # Configure retention policies
├── collection-intervals-config.tsx   # Configure scrape intervals
└── audit-log-table.tsx              # Searchable audit log
```

## Implementation Steps

### Step 1: Report Service
1. `report-service.ts`: aggregate data for each report type
   - Daily: total sent/received, bounce rate, top 5 issues, cluster health summary, alert count
   - Weekly: daily trends, domain reputation changes, blacklist incidents, capacity forecast
   - Monthly: full statistics, growth trends, incident recap, recommendations
   - IP reputation: all IPs status, BL history, warmup progress
2. Return structured data object for template rendering

### Step 2: PDF Generation
1. `pdf-service.ts`: render HTML template with report data → PDF via Puppeteer
2. HTML templates: styled with inline CSS (no external assets), charts as static images or SVG
3. Alternative: `pdfkit` for simpler table-based reports (lower resource usage)
4. Store generated PDFs in filesystem or S3-compatible storage
5. Email PDF attachment via WildDuck SMTP

### Step 3: Report Scheduling Worker
1. BullMQ cron jobs:
   - Daily: `0 8 * * *` (8AM)
   - Weekly: `0 9 * * 1` (Monday 9AM)
   - Monthly: `0 9 1 * *` (1st of month 9AM)
   - IP report: `0 7 * * *` (7AM daily)
2. Generate → store → email to configured recipients
3. Track report history in new table `report_history`: id, type, generated_at, file_path, emailed_to

### Step 4: Data Export
1. `export-service.ts`: streaming export for large datasets
   - CSV: use `csv-stringify` with stream pipeline
   - JSON: stream JSON array
   - XLSX: use `exceljs` with streaming workbook
2. `GET /reports/export?type=csv&data=email-events&from=...&to=...`
3. For large exports (>10K rows): enqueue to BullMQ, return download link when ready
4. Small exports (<10K rows): stream directly in response

### Step 5: Admin — User Management
1. CRUD for dashboard_users: create, update role, reset password, delete
2. 2FA setup: generate TOTP secret, display QR code, verify first token
3. API token management: generate tokens with optional expiry, revoke
4. All admin actions require admin role

### Step 6: Admin — Settings
1. `GET/PUT /admin/settings`: key-value store in new `settings` table
2. Categories:
   - Data retention: metrics raw days, email events days, aggregated days
   - Collection intervals: system metrics (15s), DNSBL check (5min), alert eval (30s)
   - Display: default timezone, default theme, dashboard title
   - Alert defaults: default cooldown, escalation enabled
3. Settings changes applied immediately (read from DB/Redis on each request)
4. Validation: prevent retention < 7 days, intervals < 10s

### Step 7: Audit Log
1. `audit-service.ts`: middleware/hook that logs all mutating actions
2. Log: timestamp, user_id, action (create/update/delete), resource (node/IP/rule/user), resource_id, details (JSONB diff)
3. Store in `audit_log` table
4. `GET /admin/audit-log`: paginated, filterable by user, action, resource, date range

### Step 8: Frontend — Reports Page
1. Scheduled reports section: table showing schedule, last run, status, download link
2. On-demand export: form to select data type, format, filters → trigger export
3. Report history: list of generated reports with download links

### Step 9: Frontend — Settings Pages
1. Node management: table of all nodes, register button, edit/decommission actions
2. IP management: add CIDR range, bulk actions, import CSV, export CSV
3. User management: user table, create user dialog, role dropdown, 2FA status, API tokens
4. Configuration: forms for retention, intervals, display, alert defaults
5. Audit log: searchable table with filters

### Step 10: Polish & Optimization
1. **Code splitting:** lazy-load route components (React.lazy + Suspense)
2. **ECharts tree-shaking:** import only used chart types, reduce bundle ~50%
3. **API response compression:** gzip middleware on Fastify
4. **Query optimization:** add missing indexes based on slow query log
5. **Mobile responsive:** test 768px-1366px, adjust sidebar to overlay mode
6. **Keyboard shortcuts help:** modal listing all shortcuts
7. **Full-screen mode:** toggle for NOC wall display (hide sidebar/header)
8. **Service worker:** offline status page showing last known cluster health
9. **Loading states:** skeleton loaders on all pages during data fetch
10. **Error states:** graceful error boundaries with retry buttons

## Todo List
- [ ] Backend: report service (data aggregation for daily/weekly/monthly)
- [ ] Backend: PDF generation (Puppeteer or pdfkit)
- [ ] Backend: report scheduling worker (BullMQ cron)
- [ ] Backend: streaming export service (CSV/JSON/XLSX)
- [ ] Backend: dashboard user CRUD + 2FA + API tokens
- [ ] Backend: settings CRUD (key-value store)
- [ ] Backend: audit log middleware + query endpoint
- [ ] Backend: report_history + settings + audit_log tables
- [ ] Frontend: reports page (schedule, on-demand, history)
- [ ] Frontend: node management admin
- [ ] Frontend: IP management admin
- [ ] Frontend: user management admin (roles, 2FA, tokens)
- [ ] Frontend: settings forms (retention, intervals, display)
- [ ] Frontend: audit log viewer
- [ ] Polish: code splitting + lazy loading
- [ ] Polish: ECharts tree-shaking
- [ ] Polish: mobile responsive (768-1366px)
- [ ] Polish: full-screen NOC mode
- [ ] Polish: loading skeletons + error boundaries
- [ ] Test: daily report generates PDF correctly
- [ ] Test: CSV export streams 100K rows without memory spike
- [ ] Test: 2FA TOTP flow works end-to-end

## Success Criteria
- Daily/weekly/monthly reports generate on schedule and email to admins
- PDF reports contain correct aggregated data with readable formatting
- Data export works for all data types in CSV/JSON/XLSX
- Large exports (100K+ rows) don't crash server
- Dashboard user CRUD works with proper RBAC
- 2FA setup and verification flow complete
- Settings changes take effect immediately
- Audit log captures all admin/operator actions
- Code-split routes load lazily (verify with bundle analyzer)
- App works acceptably on 1366x768 screens

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Puppeteer heavy for PDF (300MB+ install) | Med | Consider pdfkit for simpler reports; or run Puppeteer in Docker sidecar |
| Large CSV export memory spike | High | Use stream pipeline, never buffer full dataset |
| 2FA recovery (user loses TOTP device) | Med | Generate recovery codes on setup, admin can disable 2FA |

## Security Considerations
- API tokens hashed in DB, shown only once on creation
- 2FA secrets encrypted at rest
- Audit log immutable (no delete endpoint)
- Report PDFs may contain sensitive stats — restrict download to admin
- Settings changes require admin role
- Export endpoints rate-limited

## Next Steps
- Production deployment preparation
- Monitoring the monitor (meta-health checks)
- User acceptance testing with mail admin team
