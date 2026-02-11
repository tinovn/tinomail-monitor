# Phase 12 — Alerting System (PRD Module 11)

## Context Links
- [Parent Plan](./plan.md)
- [PRD Section 17: Alerting System](../wildduck-dashboard-requirements.md)
- Depends on: all previous phases (alert rules reference metrics from all modules)

## Overview
- **Priority:** P1 (Automated incident detection — core operational value)
- **Status:** pending
- **Effort:** 5-7 days
- **Description:** Build alert rule engine (BullMQ worker evaluating rules every 30s), 23 predefined template alerts from PRD, custom rule builder UI, notification channels (Telegram, Slack, Email, Webhook, In-app), alert dashboard (active, history, frequency), acknowledge/snooze/mute, and escalation system.

## Key Insights
- Alert evaluation: BullMQ repeatable job every 30s queries metrics + compares against thresholds
- State machine: pending → firing → (ack'd) → resolved. With cooldown to prevent alert storms
- 23 template rules pre-seeded in Phase 02 — this phase activates evaluation engine
- Notification channels: Telegram (fastest response), Slack, Email (via WildDuck itself), Webhook, In-app (Socket.IO)
- Escalation: L1 → L2 → L3 based on time-without-ack
- In-app alerts: Socket.IO push → toast notification + badge counter in header

## Requirements

### Functional
- **Alert rule engine:** evaluate all enabled rules every 30s, check condition against current metrics, fire if threshold exceeded for specified duration
- **Template alerts:** 23 pre-defined rules from PRD 17.1 (node down, MongoDB no primary, IP blacklisted, high bounce, queue backlog, disk full, etc.)
- **Custom rule builder:** UI form — metric selector, operator, threshold, duration, severity, notification channels
- **Notification channels:** Telegram (bot token + chat ID), Slack (webhook URL), Email (SMTP via WildDuck), Webhook (custom URL + headers), In-app (Socket.IO push)
- **Alert dashboard:** active alerts table (sorted by severity), alert history timeline, alert frequency chart (30d), per-rule stats
- **Actions:** acknowledge, snooze (1h/4h/24h), mute (disable rule)
- **Escalation:** L1 (Telegram group, 0min), L2 (direct Telegram + Slack, 15min no ack), L3 (Email manager + SMS, 30min no ack)

### Non-Functional
- Evaluation cycle: < 5s for all rules
- Notification delivery: < 10s from alert fire to channel delivery
- Support 100+ active rules without performance issues

## Architecture

### Backend New Files
```
packages/backend/src/
├── workers/
│   ├── alert-evaluation-worker.ts    # BullMQ: evaluate all rules every 30s
│   └── alert-escalation-worker.ts    # BullMQ: check un-ack'd alerts, escalate
├── services/
│   ├── alert-engine-service.ts       # Rule evaluation logic
│   ├── alert-notification-service.ts # Send to channels
│   ├── notification-channels/
│   │   ├── telegram-channel.ts       # Telegram Bot API
│   │   ├── slack-channel.ts          # Slack webhook
│   │   ├── email-channel.ts          # SMTP via WildDuck
│   │   ├── webhook-channel.ts        # Custom HTTP webhook
│   │   └── inapp-channel.ts          # Socket.IO push
│   └── alert-escalation-service.ts   # Escalation logic
├── routes/
│   ├── alerts/
│   │   ├── active.ts                 # GET /alerts (active alerts)
│   │   ├── history.ts                # GET /alerts/history
│   │   ├── rules.ts                  # GET/POST/PUT /alerts/rules
│   │   ├── acknowledge.ts            # POST /alerts/:id/ack
│   │   ├── snooze.ts                 # POST /alerts/:id/snooze
│   │   ├── channels.ts              # GET/PUT /alerts/channels (config)
│   │   └── index.ts
```

### Frontend New Files
```
src/routes/_authenticated/alerts/
├── index.tsx                        # Active alerts page
├── history.tsx                      # Alert history
└── rules.tsx                        # Rule management

src/components/alerts/
├── active-alerts-table.tsx          # Table sorted by severity
├── alert-history-timeline.tsx       # Timeline with firing + resolved
├── alert-frequency-chart.tsx        # 30d bar chart
├── alert-rule-list.tsx              # All rules: enabled toggle, edit, delete
├── alert-rule-builder.tsx           # Custom rule form
├── alert-actions-bar.tsx            # Ack, snooze, mute buttons
├── notification-channel-config.tsx  # Configure Telegram/Slack/Email/Webhook
├── escalation-config.tsx            # L1/L2/L3 escalation setup
└── alert-toast.tsx                  # In-app toast notification for new alerts
```

### Alert Evaluation Flow
```
Every 30s (BullMQ repeatable):
  1. Fetch all enabled alert_rules
  2. For each rule:
     a. Query relevant metric (e.g., metrics_system for CPU, email_stats_5m for bounce rate)
     b. Compare against threshold + operator
     c. Check duration (has condition been true for specified time?)
     d. Check cooldown (was alert fired recently?)
     e. If firing:
        - Create alert_event (status='firing')
        - Send notifications to configured channels
        - Emit Socket.IO 'alert:fired'
     f. If previously firing but now OK:
        - Update alert_event (status='resolved', resolved_at=now)
        - Send resolution notification
        - Emit Socket.IO 'alert:resolved'
```

## Implementation Steps

### Step 1: Alert Engine Service
1. `alert-engine-service.ts`: core evaluation logic
2. Rule condition types:
   - `metric_threshold`: metric > threshold for duration (most rules)
   - `absence`: no data from node for duration (node down)
   - `count`: count of events > threshold (spam reports)
   - `change`: metric changed by % (volume spike)
3. Metric resolvers: map rule.metric_name to actual DB query
4. Duration tracking: use Redis hash per rule — store timestamp when condition first became true
5. Cooldown: check alert_events.fired_at + rule.cooldown > now

### Step 2: Alert Evaluation Worker
1. BullMQ repeatable: every 30s
2. Fetch all enabled rules from alert_rules table (cache in Redis, refresh every 5min)
3. Batch evaluate: group rules by metric type to minimize DB queries
4. Parallel evaluation with concurrency limit (5 rules at a time)
5. Record evaluation metrics: total time, rules evaluated, alerts fired

### Step 3: Notification Channels
1. `telegram-channel.ts`: use Telegram Bot API (`POST /sendMessage`), format alert with severity emoji + details
2. `slack-channel.ts`: POST to webhook URL with Slack Block Kit formatted message
3. `email-channel.ts`: send via WildDuck SMTP (or dashboard's own SMTP config)
4. `webhook-channel.ts`: POST to custom URL with JSON payload + configurable headers
5. `inapp-channel.ts`: emit Socket.IO `alert:fired` to `alerts` room
6. Each channel: retry 3x on failure, log delivery status

### Step 4: Notification Channel Config
1. Store channel configs in new table `notification_channels`:
   - id, type (telegram/slack/email/webhook), name, config (JSONB), enabled
   - Telegram config: `{ bot_token, chat_id }`
   - Slack config: `{ webhook_url }`
   - Email config: `{ smtp_host, port, from, to[] }`
   - Webhook config: `{ url, method, headers, template }`
2. Link rules to channels: alert_rules.channels[] references channel IDs

### Step 5: Alert Routes
1. `GET /alerts`: active alerts (status='firing'), sorted by severity then fired_at
2. `GET /alerts/history`: all alerts with pagination, filter by rule, severity, date range
3. `GET/POST/PUT /alerts/rules`: CRUD for alert rules
4. `POST /alerts/:id/ack`: set acknowledged_by, acknowledged_at
5. `POST /alerts/:id/snooze`: set snoozed_until (now + duration)
6. `GET/PUT /alerts/channels`: notification channel CRUD

### Step 6: Escalation System
1. `alert-escalation-worker.ts`: BullMQ repeatable every 1min
2. Query firing alerts without ack:
   - L1 (0-15min): initial notification already sent
   - L2 (15-30min): send to escalation channels (direct Telegram + Slack)
   - L3 (30min+): send to manager channels (Email + SMS if configured)
3. Escalation config: levels with channel sets + time thresholds
4. Track escalation level in alert_events.details (JSONB)

### Step 7: Frontend — Active Alerts
1. `active-alerts-table.tsx`: severity icon/color, rule name, message, node, fired at, duration, actions (ack, snooze)
2. Sort: critical first, then warning, then info
3. Click row → expand details
4. Socket.IO: new alerts appear immediately, resolved alerts disappear

### Step 8: Frontend — Alert History + Frequency
1. `alert-history-timeline.tsx`: scrollable timeline, filter by severity/rule/date
2. `alert-frequency-chart.tsx`: ECharts bar chart — alerts per day over 30 days, stacked by severity
3. Per-rule stats: how often each rule fires

### Step 9: Frontend — Rule Management
1. `alert-rule-list.tsx`: table of all rules — name, severity, condition summary, enabled toggle, last fired, fire count, edit/delete
2. Template rules marked as "template" — can be cloned but not deleted
3. `alert-rule-builder.tsx`: form with:
   - Name, description
   - Metric selector (dropdown grouped by category)
   - Operator: >, <, ==, !=
   - Threshold value
   - Duration (for how long)
   - Severity: critical/warning/info
   - Channels: checkboxes for notification channels
   - Cooldown interval
   - Enable/disable toggle

### Step 10: Frontend — Channel Config + Escalation
1. `notification-channel-config.tsx`: list channels, add new, test send button
2. Each channel type: specific config form (Telegram: bot token + chat ID, Slack: webhook URL, etc.)
3. `escalation-config.tsx`: define L1/L2/L3 with time thresholds and channel sets

### Step 11: Frontend — In-App Toast
1. `alert-toast.tsx`: Socket.IO listener → toast notification in bottom-right
2. Critical: red toast with sound option
3. Warning: yellow toast
4. Info: blue toast
5. Click toast → navigate to alert detail
6. Badge counter in header (from auth store or separate alert count store)

## Todo List
- [ ] Backend: alert engine service (rule evaluation logic)
- [ ] Backend: alert evaluation BullMQ worker (30s cycle)
- [ ] Backend: notification channels (Telegram, Slack, Email, Webhook, In-app)
- [ ] Backend: notification_channels table + config
- [ ] Backend: alert routes (active, history, rules CRUD, ack, snooze)
- [ ] Backend: escalation worker + config
- [ ] Frontend: active alerts table with realtime updates
- [ ] Frontend: alert history timeline
- [ ] Frontend: alert frequency chart
- [ ] Frontend: rule list with enable/disable toggles
- [ ] Frontend: custom rule builder form
- [ ] Frontend: notification channel config UI
- [ ] Frontend: escalation config UI
- [ ] Frontend: in-app toast notifications
- [ ] Test: alert fires when threshold exceeded
- [ ] Test: Telegram notification delivered within 10s
- [ ] Test: escalation triggers at correct time intervals
- [ ] Test: ack/snooze/mute work correctly

## Success Criteria
- Alert engine evaluates all 23+ rules every 30s
- Alerts fire correctly when conditions met (e.g., CPU > 85% for 10min)
- Notifications delivered to Telegram/Slack/Email within 10s
- Active alerts table shows realtime firing/resolved status
- Custom rule builder creates functional new rules
- Ack stops escalation, snooze suppresses for duration, mute disables rule
- Escalation progresses L1 → L2 → L3 on schedule
- In-app toast shows for new alerts

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Alert evaluation > 30s cycle time | High | Batch queries by metric type, parallel evaluation, skip snoozed/muted rules |
| Alert storms (many rules fire simultaneously) | High | Cooldown per rule, rate-limit notifications per channel (max 10/min) |
| Telegram API rate limiting | Med | Queue notifications, 1 msg/sec limit per chat |
| False positives in template rules | Med | Conservative default thresholds, easy to adjust |

## Security Considerations
- Channel configs contain secrets (bot tokens, webhook URLs) — encrypt at rest in JSONB
- Alert rule creation requires admin role
- Ack/snooze requires operator or admin
- Webhook payloads should not include sensitive data
- Audit log all alert actions

## Next Steps
- Phase 13: Scheduled reports include alert summaries
- Iterate on alert thresholds based on production data
