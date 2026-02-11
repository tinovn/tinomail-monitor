/**
 * Seed sample/demo data for testing API endpoints and frontend UI.
 * Generates realistic time-series data for the last 48 hours across all tables.
 *
 * Usage: tsx src/db/seed/run-seed-sample-data.ts
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { nodes } from "../schema/nodes-table.js";
import { sendingIps } from "../schema/sending-ips-table.js";
import { sendingDomains } from "../schema/sending-domains-table.js";
import { ipPools } from "../schema/ip-pools-table.js";
import { notificationChannels } from "../schema/notification-channels-table.js";
import { alertEvents } from "../schema/alert-events-table.js";
import {
  NODES, SENDING_IPS, SENDING_DOMAINS, IP_POOLS, NOTIFICATION_CHANNELS,
  FROM_USERS, TO_DOMAINS, BOUNCE_TYPES, BOUNCE_CATEGORIES, SPAM_ACTIONS,
  rand, randInt, pick,
} from "./seed-sample-data.js";

const HOURS_BACK = 48;
const METRICS_INTERVAL_SEC = 60; // 1 data point per minute (instead of 15s to keep volume manageable)

async function seedSampleData() {
  const url = process.env.DATABASE_URL ?? "postgres://tinomail:devpassword@localhost:5432/tinomail_monitor";
  const sql = postgres(url, { max: 5 });
  const db = drizzle(sql);
  const now = Date.now();
  const startTime = now - HOURS_BACK * 60 * 60 * 1000;

  console.info(`Seeding sample data from ${new Date(startTime).toISOString()} to ${new Date(now).toISOString()}`);

  // ── 1. Nodes ──
  console.info("Seeding nodes...");
  for (const n of NODES) {
    await db.insert(nodes).values({
      id: n.id,
      hostname: n.hostname,
      ipAddress: n.ip,
      role: n.role,
      status: n.status,
      registeredAt: new Date(now - 30 * 24 * 60 * 60 * 1000),
      lastSeen: new Date(now - randInt(0, 30) * 1000),
      metadata: { platform: "linux", distro: "Ubuntu", release: "22.04", arch: "x64" },
    }).onConflictDoNothing();
  }
  console.info(`  ${NODES.length} nodes`);

  // ── 2. Sending IPs ──
  console.info("Seeding sending IPs...");
  for (const s of SENDING_IPS) {
    await db.insert(sendingIps).values({
      ip: s.ip,
      ipVersion: s.v as 4,
      nodeId: s.nodeId,
      subnet: s.subnet,
      ptrRecord: s.ptr,
      status: s.status,
      warmupDay: s.warmupDay,
      dailyLimit: s.dailyLimit,
      currentDailySent: randInt(0, s.dailyLimit * 0.7),
      blacklistCount: "blCount" in s ? (s as any).blCount : 0,
      reputationScore: s.rep,
      lastBlacklistCheck: new Date(now - randInt(0, 300) * 1000),
    }).onConflictDoNothing();
  }
  console.info(`  ${SENDING_IPS.length} sending IPs`);

  // ── 3. Sending Domains ──
  console.info("Seeding sending domains...");
  for (const d of SENDING_DOMAINS) {
    await db.insert(sendingDomains).values({
      domain: d.domain,
      dkimConfigured: d.dkim,
      spfConfigured: d.spf,
      dmarcConfigured: d.dmarc,
      dmarcPolicy: d.dmarcPolicy,
      status: d.status,
      dailyLimit: d.dailyLimit,
    }).onConflictDoNothing();
  }
  console.info(`  ${SENDING_DOMAINS.length} domains`);

  // ── 4. IP Pools ──
  console.info("Seeding IP pools...");
  for (const p of IP_POOLS) {
    await db.insert(ipPools).values({
      name: p.name,
      type: p.type,
      ips: p.ips,
      description: p.description,
    }).onConflictDoNothing();
  }
  console.info(`  ${IP_POOLS.length} IP pools`);

  // ── 5. Notification Channels ──
  console.info("Seeding notification channels...");
  for (const ch of NOTIFICATION_CHANNELS) {
    await db.insert(notificationChannels).values({
      type: ch.type,
      name: ch.name,
      config: ch.config,
    }).onConflictDoNothing();
  }
  console.info(`  ${NOTIFICATION_CHANNELS.length} channels`);

  // ── 6. System Metrics (metrics_system) ──
  console.info("Seeding system metrics...");
  let sysCount = 0;
  const sysRows: string[] = [];
  for (let t = startTime; t < now; t += METRICS_INTERVAL_SEC * 1000) {
    const ts = new Date(t).toISOString();
    for (const n of NODES) {
      const hour = new Date(t).getUTCHours();
      // Simulate day/night load pattern
      const loadFactor = hour >= 8 && hour <= 20 ? 1.3 : 0.7;
      const baseCpu = n.role === "zonemta-outbound" ? 40 : n.role === "mongodb" ? 30 : 25;
      const baseRam = n.role === "mongodb" ? 60 : n.role === "zonemta-outbound" ? 45 : 35;

      sysRows.push(`('${ts}','${n.id}','${n.role}',${
        (baseCpu * loadFactor + rand(-10, 15)).toFixed(1)},${
        (baseRam + rand(-5, 10)).toFixed(1)},${
        randInt(1e9, 8e9)},${
        rand(20, 70).toFixed(1)},${
        randInt(5e9, 50e9)},${
        randInt(1e5, 5e7)},${
        randInt(1e5, 5e7)},${
        randInt(1e5, 1e8)},${
        randInt(1e5, 1e8)},${
        randInt(0, 50)},${randInt(0, 20)},${
        (rand(0.5, 4) * loadFactor).toFixed(2)},${
        (rand(0.3, 3) * loadFactor).toFixed(2)},${
        (rand(0.2, 2) * loadFactor).toFixed(2)},${
        randInt(50, 500)},${
        randInt(10, 200)},${
        randInt(100, 5000)})`);

      if (sysRows.length >= 500) {
        await sql.unsafe(`INSERT INTO metrics_system (time,node_id,node_role,cpu_percent,ram_percent,ram_used_bytes,disk_percent,disk_free_bytes,disk_read_bytes_sec,disk_write_bytes_sec,net_rx_bytes_sec,net_tx_bytes_sec,net_rx_errors,net_tx_errors,load_1m,load_5m,load_15m,tcp_established,tcp_time_wait,open_files) VALUES ${sysRows.join(",")}`);
        sysCount += sysRows.length;
        sysRows.length = 0;
      }
    }
  }
  if (sysRows.length > 0) {
    await sql.unsafe(`INSERT INTO metrics_system (time,node_id,node_role,cpu_percent,ram_percent,ram_used_bytes,disk_percent,disk_free_bytes,disk_read_bytes_sec,disk_write_bytes_sec,net_rx_bytes_sec,net_tx_bytes_sec,net_rx_errors,net_tx_errors,load_1m,load_5m,load_15m,tcp_established,tcp_time_wait,open_files) VALUES ${sysRows.join(",")}`);
    sysCount += sysRows.length;
  }
  console.info(`  ${sysCount} system metrics rows`);

  // ── 7. ZoneMTA Metrics (metrics_zonemta) — only ZoneMTA nodes ──
  console.info("Seeding ZoneMTA metrics...");
  let zmtaCount = 0;
  const zmtaRows: string[] = [];
  const zmtaNodes = NODES.filter(n => n.role === "zonemta-outbound");
  for (let t = startTime; t < now; t += METRICS_INTERVAL_SEC * 1000) {
    const ts = new Date(t).toISOString();
    const elapsed = (t - startTime) / 1000;
    for (const n of zmtaNodes) {
      const baseSent = 10000 + elapsed * 0.5;
      const nodeIdx = parseInt(n.id.replace("zonemta-", ""), 10);
      const sentTotal = Math.floor(baseSent * (0.8 + nodeIdx * 0.05));
      const deliveredTotal = Math.floor(sentTotal * rand(0.92, 0.98));
      const bouncedTotal = Math.floor(sentTotal * rand(0.01, 0.04));
      const deferredTotal = Math.floor(sentTotal * rand(0.01, 0.03));
      const rejectedTotal = Math.floor(sentTotal * rand(0.001, 0.005));

      zmtaRows.push(`('${ts}','${n.id}','outbound',${
        randInt(50, 2000)},${randInt(10, 200)},${
        sentTotal},${deliveredTotal},${bouncedTotal},${deferredTotal},${rejectedTotal},${
        randInt(20, 300)},${rand(5, 80).toFixed(2)})`);

      if (zmtaRows.length >= 500) {
        await sql.unsafe(`INSERT INTO metrics_zonemta (time,node_id,mta_role,queue_size,active_deliveries,sent_total,delivered_total,bounced_total,deferred_total,rejected_total,connections_active,throughput_per_sec) VALUES ${zmtaRows.join(",")}`);
        zmtaCount += zmtaRows.length;
        zmtaRows.length = 0;
      }
    }
  }
  if (zmtaRows.length > 0) {
    await sql.unsafe(`INSERT INTO metrics_zonemta (time,node_id,mta_role,queue_size,active_deliveries,sent_total,delivered_total,bounced_total,deferred_total,rejected_total,connections_active,throughput_per_sec) VALUES ${zmtaRows.join(",")}`);
    zmtaCount += zmtaRows.length;
  }
  console.info(`  ${zmtaCount} ZoneMTA metrics rows`);

  // ── 8. MongoDB Metrics — only MongoDB nodes ──
  console.info("Seeding MongoDB metrics...");
  let mongoCount = 0;
  const mongoRows: string[] = [];
  const mongoNodes = NODES.filter(n => n.role === "mongodb");
  const mongoRoles = ["primary", "secondary", "secondary"];
  for (let t = startTime; t < now; t += METRICS_INTERVAL_SEC * 1000) {
    const ts = new Date(t).toISOString();
    for (let i = 0; i < mongoNodes.length; i++) {
      const n = mongoNodes[i];
      const role = mongoRoles[i];
      const isPrimary = role === "primary";
      mongoRows.push(`('${ts}','${n.id}','${role}',${
        randInt(50, 300)},${randInt(500, 1000)},${
        isPrimary ? randInt(100, 2000) : randInt(0, 50)},${
        randInt(500, 5000)},${
        isPrimary ? randInt(50, 500) : randInt(0, 20)},${
        randInt(10, 100)},${
        randInt(100, 1000)},${
        isPrimary ? 0 : rand(0, 2).toFixed(3)},${
        randInt(5e9, 20e9)},${
        randInt(1e9, 5e9)},${
        randInt(8e9, 30e9)},${
        rand(24, 72).toFixed(1)},${
        randInt(1e9, 4e9)},${randInt(4e9, 8e9)})`);

      if (mongoRows.length >= 500) {
        await sql.unsafe(`INSERT INTO metrics_mongodb (time,node_id,role,connections_current,connections_available,ops_insert,ops_query,ops_update,ops_delete,ops_command,repl_lag_seconds,data_size_bytes,index_size_bytes,storage_size_bytes,oplog_window_hours,wt_cache_used_bytes,wt_cache_max_bytes) VALUES ${mongoRows.join(",")}`);
        mongoCount += mongoRows.length;
        mongoRows.length = 0;
      }
    }
  }
  if (mongoRows.length > 0) {
    await sql.unsafe(`INSERT INTO metrics_mongodb (time,node_id,role,connections_current,connections_available,ops_insert,ops_query,ops_update,ops_delete,ops_command,repl_lag_seconds,data_size_bytes,index_size_bytes,storage_size_bytes,oplog_window_hours,wt_cache_used_bytes,wt_cache_max_bytes) VALUES ${mongoRows.join(",")}`);
    mongoCount += mongoRows.length;
  }
  console.info(`  ${mongoCount} MongoDB metrics rows`);

  // ── 9. Redis Metrics — single Redis node (wildduck-01) ──
  console.info("Seeding Redis metrics...");
  let redisCount = 0;
  const redisRows: string[] = [];
  for (let t = startTime; t < now; t += METRICS_INTERVAL_SEC * 1000) {
    const ts = new Date(t).toISOString();
    redisRows.push(`('${ts}','wildduck-01',${
      randInt(200e6, 800e6)},${1073741824},${
      randInt(10, 80)},${
      randInt(5000, 30000)},${
      rand(0.90, 0.99).toFixed(4)},${
      randInt(0, 100)},${
      randInt(50000, 200000)})`);

    if (redisRows.length >= 500) {
      await sql.unsafe(`INSERT INTO metrics_redis (time,node_id,memory_used_bytes,memory_max_bytes,connected_clients,ops_per_sec,hit_rate,evicted_keys,total_keys) VALUES ${redisRows.join(",")}`);
      redisCount += redisRows.length;
      redisRows.length = 0;
    }
  }
  if (redisRows.length > 0) {
    await sql.unsafe(`INSERT INTO metrics_redis (time,node_id,memory_used_bytes,memory_max_bytes,connected_clients,ops_per_sec,hit_rate,evicted_keys,total_keys) VALUES ${redisRows.join(",")}`);
    redisCount += redisRows.length;
  }
  console.info(`  ${redisCount} Redis metrics rows`);

  // ── 10. Rspamd Metrics — haraka node ──
  console.info("Seeding Rspamd metrics...");
  let rspamdCount = 0;
  const rspamdRows: string[] = [];
  for (let t = startTime; t < now; t += METRICS_INTERVAL_SEC * 1000) {
    const ts = new Date(t).toISOString();
    const scanned = randInt(100, 800);
    const spam = Math.floor(scanned * rand(0.02, 0.08));
    const greylist = Math.floor(scanned * rand(0.01, 0.05));
    const rejected = Math.floor(scanned * rand(0.005, 0.02));
    const ham = scanned - spam - greylist - rejected;

    rspamdRows.push(`('${ts}','haraka-01',${scanned},${ham},${spam},${greylist},${rejected},${randInt(0, 5)},${randInt(0, 3)})`);

    if (rspamdRows.length >= 500) {
      await sql.unsafe(`INSERT INTO metrics_rspamd (time,node_id,scanned,ham,spam,greylist,rejected,learned_ham,learned_spam) VALUES ${rspamdRows.join(",")}`);
      rspamdCount += rspamdRows.length;
      rspamdRows.length = 0;
    }
  }
  if (rspamdRows.length > 0) {
    await sql.unsafe(`INSERT INTO metrics_rspamd (time,node_id,scanned,ham,spam,greylist,rejected,learned_ham,learned_spam) VALUES ${rspamdRows.join(",")}`);
    rspamdCount += rspamdRows.length;
  }
  console.info(`  ${rspamdCount} Rspamd metrics rows`);

  // ── 11. Email Events ──
  console.info("Seeding email events (this may take a moment)...");
  let emailCount = 0;
  const emailRows: string[] = [];
  // Generate ~50-200 events per 5-minute bucket
  for (let t = startTime; t < now; t += 5 * 60 * 1000) {
    const hour = new Date(t).getUTCHours();
    const loadFactor = hour >= 6 && hour <= 22 ? 1.5 : 0.5;
    const batchSize = Math.floor(randInt(50, 200) * loadFactor);

    for (let i = 0; i < batchSize; i++) {
      const eventTime = new Date(t + randInt(0, 5 * 60 * 1000)).toISOString();
      const fromUser = pick(FROM_USERS);
      const fromDomain = pick(SENDING_DOMAINS).domain;
      const toDomain = pick(TO_DOMAINS);
      const mtaNode = pick(zmtaNodes).id;
      const sendIp = pick(SENDING_IPS).ip;

      // Weighted event type: 70% delivered, 15% accepted, 8% deferred, 5% bounced, 2% complained
      const r = Math.random();
      let eventType: string;
      if (r < 0.70) eventType = "delivered";
      else if (r < 0.85) eventType = "accepted";
      else if (r < 0.93) eventType = "deferred";
      else if (r < 0.98) eventType = "bounced";
      else eventType = "complained";

      const messageId = `${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 8)}@${fromDomain}`;
      const queueId = Math.random().toString(36).slice(2, 14).toUpperCase();
      const deliveryMs = eventType === "delivered" ? randInt(200, 15000) : (eventType === "deferred" ? randInt(5000, 60000) : 0);
      const queueMs = randInt(10, 2000);
      const statusCode = eventType === "delivered" ? 250 : (eventType === "bounced" ? pick([450, 550, 552, 553]) : (eventType === "deferred" ? pick([421, 451, 452]) : 0));

      let bounceType = "NULL";
      let bounceCat = "NULL";
      let bounceMsg = "NULL";
      if (eventType === "bounced") {
        bounceType = `'${pick(BOUNCE_TYPES)}'`;
        bounceCat = `'${pick(BOUNCE_CATEGORIES)}'`;
        bounceMsg = `'${statusCode} ${pick(["User unknown", "Mailbox full", "DNS error", "Policy rejection", "Message rejected"])}'`;
      }

      const spamScore = rand(0, 3).toFixed(2);
      const spamAction = eventType === "complained" ? "'reject'" : `'${pick(SPAM_ACTIONS)}'`;
      const dkim = pick(["pass", "pass", "pass", "fail"]);
      const spf = pick(["pass", "pass", "pass", "softfail", "fail"]);
      const dmarc = pick(["pass", "pass", "pass", "fail"]);

      emailRows.push(`('${eventTime}','${eventType}','${messageId}','${queueId}','${fromUser}@${fromDomain}','${fromUser}','${fromDomain}','recipient${randInt(1,999)}@${toDomain}','${toDomain}','${mtaNode}','${sendIp}',NULL,NULL,${statusCode === 0 ? "NULL" : statusCode},NULL,${deliveryMs || "NULL"},${queueMs},${deliveryMs ? deliveryMs + queueMs : "NULL"},${bounceType},${bounceCat},${bounceMsg},${randInt(1000, 50000)},'${dkim}','${spf}','${dmarc}',${spamScore},${spamAction})`);

      if (emailRows.length >= 500) {
        await sql.unsafe(`INSERT INTO email_events (time,event_type,message_id,queue_id,from_address,from_user,from_domain,to_address,to_domain,mta_node,sending_ip,sending_ip_v6,mx_host,status_code,status_message,delivery_time_ms,queue_time_ms,total_time_ms,bounce_type,bounce_category,bounce_message,message_size,dkim_result,spf_result,dmarc_result,spam_score,spam_action) VALUES ${emailRows.join(",")}`);
        emailCount += emailRows.length;
        emailRows.length = 0;
        if (emailCount % 5000 === 0) {
          process.stdout.write(`  ${emailCount} events...\r`);
        }
      }
    }
  }
  if (emailRows.length > 0) {
    await sql.unsafe(`INSERT INTO email_events (time,event_type,message_id,queue_id,from_address,from_user,from_domain,to_address,to_domain,mta_node,sending_ip,sending_ip_v6,mx_host,status_code,status_message,delivery_time_ms,queue_time_ms,total_time_ms,bounce_type,bounce_category,bounce_message,message_size,dkim_result,spf_result,dmarc_result,spam_score,spam_action) VALUES ${emailRows.join(",")}`);
    emailCount += emailRows.length;
  }
  console.info(`  ${emailCount} email events`);

  // ── 12. Blacklist Checks ──
  console.info("Seeding blacklist checks...");
  let blCount = 0;
  const blRows: string[] = [];
  const blacklists = [
    "zen.spamhaus.org", "b.barracudacentral.org", "bl.spamcop.net",
    "cbl.abuseat.org", "dnsbl.sorbs.net", "dnsbl-1.uceprotect.net",
  ];
  // Check every 5 min for last 24h
  const blStart = now - 24 * 60 * 60 * 1000;
  for (let t = blStart; t < now; t += 5 * 60 * 1000) {
    const ts = new Date(t).toISOString();
    for (const sip of SENDING_IPS) {
      for (const bl of blacklists) {
        // IP .17 is quarantined with 2 blacklist hits
        const listed = sip.ip === "103.56.160.17" && (bl === "zen.spamhaus.org" || bl === "bl.spamcop.net");
        const tier = bl.includes("spamhaus") || bl.includes("barracuda") || bl.includes("spamcop") ? "critical" : "high";
        blRows.push(`('${ts}','${sip.ip}',4,'${sip.nodeId}','${bl}','${tier}',${listed},${listed ? "'127.0.0.2'" : "NULL"},${randInt(20, 300)})`);

        if (blRows.length >= 500) {
          await sql.unsafe(`INSERT INTO blacklist_checks (time,ip,ip_version,node_id,blacklist,tier,listed,response,check_duration_ms) VALUES ${blRows.join(",")}`);
          blCount += blRows.length;
          blRows.length = 0;
        }
      }
    }
  }
  if (blRows.length > 0) {
    await sql.unsafe(`INSERT INTO blacklist_checks (time,ip,ip_version,node_id,blacklist,tier,listed,response,check_duration_ms) VALUES ${blRows.join(",")}`);
    blCount += blRows.length;
  }
  console.info(`  ${blCount} blacklist check rows`);

  // ── 13. Alert Events ──
  console.info("Seeding alert events...");
  const alertData = [
    { ruleId: 1, severity: "critical", status: "active", message: "Node zonemta-09 CPU at 96% for 5 minutes", nodeId: "zonemta-09", hoursAgo: 2 },
    { ruleId: 6, severity: "critical", status: "active", message: "IP 103.56.160.17 listed on zen.spamhaus.org", nodeId: "zonemta-08", hoursAgo: 8 },
    { ruleId: 5, severity: "critical", status: "resolved", message: "Bounce rate spike: 18% for 10 minutes", nodeId: null, hoursAgo: 18, resolvedHoursAgo: 17 },
    { ruleId: 8, severity: "warning", status: "active", message: "CPU at 84% on zonemta-09 for 10 minutes", nodeId: "zonemta-09", hoursAgo: 3 },
    { ruleId: 11, severity: "warning", status: "active", message: "Bounce rate 9.2% for tino.org for 15 minutes", nodeId: null, hoursAgo: 1 },
    { ruleId: 13, severity: "warning", status: "resolved", message: "Avg delivery time 35s for 10 minutes", nodeId: "zonemta-05", hoursAgo: 12, resolvedHoursAgo: 11 },
    { ruleId: 15, severity: "warning", status: "resolved", message: "Queue size 12K on zonemta-03 for 15 minutes", nodeId: "zonemta-03", hoursAgo: 20, resolvedHoursAgo: 19 },
    { ruleId: 20, severity: "info", status: "active", message: "Node zonemta-09 status changed to warning", nodeId: "zonemta-09", hoursAgo: 3 },
    { ruleId: 21, severity: "info", status: "resolved", message: "IP 103.56.160.15 status changed to paused", nodeId: "zonemta-06", hoursAgo: 24, resolvedHoursAgo: 23 },
    { ruleId: 23, severity: "info", status: "active", message: "Unusual sending pattern detected for marketing@tino.org", nodeId: null, hoursAgo: 5 },
  ];

  for (const a of alertData) {
    await db.insert(alertEvents).values({
      ruleId: a.ruleId,
      severity: a.severity,
      status: a.status,
      message: a.message,
      nodeId: a.nodeId,
      firedAt: new Date(now - a.hoursAgo * 60 * 60 * 1000),
      resolvedAt: "resolvedHoursAgo" in a ? new Date(now - (a as any).resolvedHoursAgo * 60 * 60 * 1000) : undefined,
      notified: true,
      escalationLevel: a.severity === "critical" ? 1 : 0,
    });
  }
  console.info(`  ${alertData.length} alert events`);

  // ── Done ──
  console.info("\nSample data seed complete!");
  await sql.end();
}

seedSampleData().catch((err) => {
  console.error("Sample data seed failed:", err);
  process.exit(1);
});
