# Phase 04: Build, Test, and Deploy to ZoneMTA Nodes

## Context Links

- [Agent package.json](../../packages/agent/package.json)
- [Deploy script](../../docs/system-architecture.md)
- [Self-updater](../../packages/agent/src/self-updater.ts)
- [Agent config](../../packages/agent/src/agent-config.ts)

## Overview

- **Priority**: P1
- **Status**: pending
- **Description**: Build agent, verify compilation, test on one ZoneMTA node, then deploy to all 10+ ZoneMTA outbound nodes.

## Key Insights

- Agent build: `npm run build:agent` (TypeScript -> dist/)
- Agent self-updater pulls new files from backend — new collector files must be in the update file list
- ZoneMTA nodes already run the agent for system + ZoneMTA HTTP metrics
- Need to add `AGENT_ZONEMTA_MONGODB_URI` to each node's env config
- MongoDB for ZoneMTA is shared (single replica set) — all ZoneMTA nodes connect to same cluster

## Requirements

### Functional
- Agent compiles without errors
- New collector files included in agent self-update manifest
- `AGENT_ZONEMTA_MONGODB_URI` added to ZoneMTA node env files
- Events visible in backend logs / TimescaleDB `email_events` table after deploy

### Non-functional
- Zero downtime deploy via agent self-updater
- Verify memory stays ~20MB (change stream should add minimal overhead)

## Architecture

```
Build Pipeline:
  npm run build:agent → dist/

Deploy Pipeline (per ZoneMTA node):
  1. Add AGENT_ZONEMTA_MONGODB_URI to .env
  2. Restart agent (or let self-updater pick up new files)
  3. Verify: check agent logs for "[Agent] ZoneMTA email event collector started"
  4. Verify: query email_events table for new rows
```

## Related Code Files

### Modify
- Agent `.env` on each ZoneMTA node — add `AGENT_ZONEMTA_MONGODB_URI`
- `packages/agent/src/self-updater.ts` — ensure new files in update list (if needed)

### Verify
- `packages/agent/dist/` — compiled output
- Backend logs — event ingestion confirmations

## Implementation Steps

1. **Build agent locally**
   ```bash
   npm run build:agent
   ```
   Verify no TypeScript errors.

2. **Bump agent version**
   - Update `AGENT_VERSION` in `agent-config.ts` from `"0.2.0"` to `"0.3.0"`
   - This triggers self-updater on remote nodes

3. **Verify self-updater file list**
   - Check `self-updater.ts` file list includes new files:
     - `dist/collectors/zonemta-email-event-collector.js`
     - `dist/transport/event-http-transport.js`
   - If self-updater uses glob pattern (e.g., `dist/**/*.js`), no change needed
   - If explicit file list, add the two new files

4. **Deploy to backend server first**
   ```bash
   ssh 103.142.24.72
   cd /opt/tinomail-monitor/app
   bash /opt/tinomail-monitor/deploy.sh
   ```
   Backend needs no changes — ingestion endpoint already exists.

5. **Test on single ZoneMTA node**
   - SSH into one ZoneMTA node
   - Add to agent `.env`:
     ```
     AGENT_ZONEMTA_MONGODB_URI=mongodb://mongodb-01.internal:27017,mongodb-02.internal:27017,mongodb-03.internal:27017/zone-mta?replicaSet=rs0
     ```
   - Restart agent: `systemctl restart tinomail-agent`
   - Watch logs: `journalctl -u tinomail-agent -f`
   - Expected: `[Agent] ZoneMTA email event collector started`
   - Send a test email through ZoneMTA
   - Verify in TimescaleDB:
     ```sql
     SELECT * FROM email_events ORDER BY time DESC LIMIT 10;
     ```

6. **Verify resource usage**
   ```bash
   ps aux | grep tinomail-agent
   ```
   Confirm RSS stays around 20-25MB.

7. **Roll out to all ZoneMTA nodes**
   - Add `AGENT_ZONEMTA_MONGODB_URI` to each node's `.env`
   - Restart agents (or trigger self-update)
   - Monitor backend logs for ingestion from all nodes

8. **Verify resume token recovery**
   - Restart agent on test node
   - Check `/tmp/tinomail-agent-zonemta-resume.json` exists
   - Confirm no duplicate events after restart

## Todo List

- [ ] Build agent: `npm run build:agent` — verify no errors
- [ ] Bump `AGENT_VERSION` to `"0.3.0"`
- [ ] Verify new files in self-updater manifest
- [ ] Deploy backend (deploy.sh)
- [ ] Test on single ZoneMTA node with env var
- [ ] Verify events in `email_events` TimescaleDB table
- [ ] Check agent memory usage stays ~20MB
- [ ] Test resume token recovery on restart
- [ ] Roll out to all ZoneMTA nodes
- [ ] Monitor for errors across all nodes (24h)

## Success Criteria

- Agent builds without TypeScript errors
- Events flow: ZoneMTA -> agent change stream -> backend -> TimescaleDB
- `email_events` table populates with delivered/bounced/deferred events
- Resume token survives restart; no event gaps
- Agent memory stays under 30MB
- All 10+ ZoneMTA nodes reporting events

## Risk Assessment

- **Medium**: MongoDB connection string must include all replica set members and `replicaSet=rs0` for change streams to work
- **Medium**: First deploy on wrong MongoDB URI could fail silently — test node first
- **Low**: Self-updater file list may need manual update if explicit (not glob-based)
- **Low**: /tmp resume token file lost on reboot — acceptable, agent replays from latest oplog position

## Security Considerations

- `AGENT_ZONEMTA_MONGODB_URI` in `.env` files — ensure `.env` is not in git, permissions 600
- MongoDB connection uses internal network only (not exposed to internet)

## Next Steps

- Monitor event ingestion rates in dashboard (Email Flow module)
- Consider adding `received` event type from WildDuck/Haraka in future
- Review continuous aggregates include email_events data
