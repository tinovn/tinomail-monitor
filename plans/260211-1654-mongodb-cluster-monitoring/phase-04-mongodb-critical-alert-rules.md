# Phase 4: MongoDB Critical Alert Rules

## Context Links
- Parent: [plan.md](plan.md)
- Depends on: None (independent, but best after Phase 2)
- Alert rules seed: [seed-alert-rules.ts](../../packages/backend/src/db/seed/seed-alert-rules.ts)
- PRD: Section 17 (Alerting — Alert #2, #3)

## Overview
- **Priority**: P2
- **Status**: pending
- **Description**: Add 2 missing MongoDB alert rules from PRD: "MongoDB No Primary" (critical) and "MongoDB Repl Lag Critical" (critical, threshold 30s). Existing "MongoDB Repl Lag" warning (threshold 10s) already present.

## Key Insights
- Alert rules are static seed data in `ALERT_RULES_SEED_DATA` array
- Structure: `{ name, severity, condition, threshold, duration?, channels, description }`
- All alerts use `channels: ["telegram"]`
- Condition strings are evaluated by alert evaluation engine (BullMQ job)
- Existing MongoDB alert: `{ name: "MongoDB Repl Lag", severity: "warning", condition: "repl_lag_seconds > threshold", threshold: 10, duration: "5 minutes" }`

## Requirements

### Functional
- Add "MongoDB No Primary" critical alert: fires when no MongoDB node has `role = 'PRIMARY'`
- Add "MongoDB Repl Lag Critical" alert: fires when `repl_lag_seconds > 30` for any node

## Related Code Files

### Modify
- `packages/backend/src/db/seed/seed-alert-rules.ts` — add 2 alert rules to array

## Implementation Steps

### Step 1: Add Alert Rules
File: `packages/backend/src/db/seed/seed-alert-rules.ts`

Add to critical section (after "Queue Overflow"):
```typescript
{ name: "MongoDB No Primary", severity: "critical", condition: "mongodb_no_primary", threshold: 1, channels: ["telegram"], description: "No MongoDB node reporting PRIMARY role" },
{ name: "MongoDB Repl Lag Critical", severity: "critical", condition: "repl_lag_seconds > threshold", threshold: 30, duration: "2 minutes", channels: ["telegram"], description: "MongoDB replication lag above 30s for 2 minutes" },
```

## Todo List
- [ ] Add "MongoDB No Primary" critical alert rule
- [ ] Add "MongoDB Repl Lag Critical" alert rule
- [ ] Verify seed script still compiles

## Success Criteria
- Seed data includes all 3 MongoDB alerts (1 existing warning + 2 new critical)
- Alert conditions are evaluable by existing alert engine patterns

## Risk Assessment
- **Low risk**: additive change to seed array, no logic change
- **Alert evaluation**: `mongodb_no_primary` condition may need backend support in alert evaluator — document as follow-up if not already handled

## Security Considerations
- None — alert rules are internal configuration
