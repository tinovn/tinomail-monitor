/**
 * Sample data generator for testing API and frontend.
 * Generates realistic time-series data for the last 24-48 hours.
 */

// ── Node Definitions ──
export const NODES = [
  // MongoDB cluster
  { id: "mongo-01", hostname: "db-mongo-01.mail.tino.org", ip: "10.0.1.10", role: "mongodb", status: "active" },
  { id: "mongo-02", hostname: "db-mongo-02.mail.tino.org", ip: "10.0.1.11", role: "mongodb", status: "active" },
  { id: "mongo-03", hostname: "db-mongo-03.mail.tino.org", ip: "10.0.1.12", role: "mongodb", status: "active" },
  // WildDuck + Haraka inbound
  { id: "wildduck-01", hostname: "imap-01.mail.tino.org", ip: "10.0.2.10", role: "wildduck", status: "active" },
  { id: "haraka-01", hostname: "mx-01.mail.tino.org", ip: "10.0.2.20", role: "haraka-inbound", status: "active" },
  // ZoneMTA outbound
  { id: "zonemta-01", hostname: "mta-01.mail.tino.org", ip: "10.0.3.1", role: "zonemta-outbound", status: "active" },
  { id: "zonemta-02", hostname: "mta-02.mail.tino.org", ip: "10.0.3.2", role: "zonemta-outbound", status: "active" },
  { id: "zonemta-03", hostname: "mta-03.mail.tino.org", ip: "10.0.3.3", role: "zonemta-outbound", status: "active" },
  { id: "zonemta-04", hostname: "mta-04.mail.tino.org", ip: "10.0.3.4", role: "zonemta-outbound", status: "active" },
  { id: "zonemta-05", hostname: "mta-05.mail.tino.org", ip: "10.0.3.5", role: "zonemta-outbound", status: "active" },
  { id: "zonemta-06", hostname: "mta-06.mail.tino.org", ip: "10.0.3.6", role: "zonemta-outbound", status: "active" },
  { id: "zonemta-07", hostname: "mta-07.mail.tino.org", ip: "10.0.3.7", role: "zonemta-outbound", status: "active" },
  { id: "zonemta-08", hostname: "mta-08.mail.tino.org", ip: "10.0.3.8", role: "zonemta-outbound", status: "active" },
  { id: "zonemta-09", hostname: "mta-09.mail.tino.org", ip: "10.0.3.9", role: "zonemta-outbound", status: "warning" },
  { id: "zonemta-10", hostname: "mta-10.mail.tino.org", ip: "10.0.3.10", role: "zonemta-outbound", status: "active" },
];

// ── Sending IPs ──
export const SENDING_IPS = [
  { ip: "103.56.160.10", v: 4, nodeId: "zonemta-01", subnet: "103.56.160.0/24", ptr: "mta-01.mail.tino.org", status: "active", warmupDay: 90, dailyLimit: 50000, rep: 85 },
  { ip: "103.56.160.11", v: 4, nodeId: "zonemta-02", subnet: "103.56.160.0/24", ptr: "mta-02.mail.tino.org", status: "active", warmupDay: 90, dailyLimit: 50000, rep: 82 },
  { ip: "103.56.160.12", v: 4, nodeId: "zonemta-03", subnet: "103.56.160.0/24", ptr: "mta-03.mail.tino.org", status: "active", warmupDay: 60, dailyLimit: 30000, rep: 78 },
  { ip: "103.56.160.13", v: 4, nodeId: "zonemta-04", subnet: "103.56.160.0/24", ptr: "mta-04.mail.tino.org", status: "active", warmupDay: 45, dailyLimit: 20000, rep: 70 },
  { ip: "103.56.160.14", v: 4, nodeId: "zonemta-05", subnet: "103.56.160.0/24", ptr: "mta-05.mail.tino.org", status: "active", warmupDay: 30, dailyLimit: 10000, rep: 65 },
  { ip: "103.56.160.15", v: 4, nodeId: "zonemta-06", subnet: "103.56.160.0/24", ptr: "mta-06.mail.tino.org", status: "paused", warmupDay: 10, dailyLimit: 3000, rep: 50 },
  { ip: "103.56.160.16", v: 4, nodeId: "zonemta-07", subnet: "103.56.160.0/24", ptr: "mta-07.mail.tino.org", status: "active", warmupDay: 90, dailyLimit: 50000, rep: 88 },
  { ip: "103.56.160.17", v: 4, nodeId: "zonemta-08", subnet: "103.56.160.0/24", ptr: "mta-08.mail.tino.org", status: "quarantine", warmupDay: 5, dailyLimit: 1000, rep: 30, blCount: 2 },
  { ip: "103.56.160.18", v: 4, nodeId: "zonemta-09", subnet: "103.56.160.0/24", ptr: "mta-09.mail.tino.org", status: "active", warmupDay: 20, dailyLimit: 8000, rep: 60 },
  { ip: "103.56.160.19", v: 4, nodeId: "zonemta-10", subnet: "103.56.160.0/24", ptr: "mta-10.mail.tino.org", status: "active", warmupDay: 75, dailyLimit: 40000, rep: 80 },
];

// ── Sending Domains ──
export const SENDING_DOMAINS = [
  { domain: "tino.org", dkim: true, spf: true, dmarc: true, dmarcPolicy: "reject", status: "active", dailyLimit: 100000 },
  { domain: "tinohost.com", dkim: true, spf: true, dmarc: true, dmarcPolicy: "quarantine", status: "active", dailyLimit: 50000 },
  { domain: "mail.tino.org", dkim: true, spf: true, dmarc: true, dmarcPolicy: "reject", status: "active", dailyLimit: 80000 },
  { domain: "support.tino.org", dkim: true, spf: true, dmarc: true, dmarcPolicy: "reject", status: "active", dailyLimit: 20000 },
  { domain: "newsletter.tino.org", dkim: true, spf: true, dmarc: false, dmarcPolicy: "none", status: "active", dailyLimit: 30000 },
  { domain: "alerts.tino.org", dkim: true, spf: true, dmarc: true, dmarcPolicy: "reject", status: "active", dailyLimit: 10000 },
];

// ── IP Pools ──
export const IP_POOLS = [
  { name: "Transactional", type: "transactional", ips: ["103.56.160.10", "103.56.160.11", "103.56.160.16"], description: "High-priority transactional emails" },
  { name: "Marketing", type: "marketing", ips: ["103.56.160.12", "103.56.160.13", "103.56.160.14"], description: "Marketing campaigns and newsletters" },
  { name: "Notification", type: "notification", ips: ["103.56.160.18", "103.56.160.19"], description: "System notifications and alerts" },
  { name: "Warmup", type: "warmup", ips: ["103.56.160.15", "103.56.160.17"], description: "New IPs in warmup phase" },
];

// ── Notification Channels ──
export const NOTIFICATION_CHANNELS = [
  { type: "telegram", name: "NOC Telegram", config: { chatId: "-1001234567890", botToken: "demo:token" } },
  { type: "email", name: "Ops Team Email", config: { to: ["ops@tino.org"], from: "alerts@tino.org" } },
  { type: "webhook", name: "Slack Webhook", config: { url: "https://hooks.slack.com/services/demo" } },
];

// ── Helper: Random in range ──
export function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max));
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Destination domains (realistic distribution) ──
export const TO_DOMAINS = [
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com",
  "icloud.com", "mail.ru", "yandex.ru", "protonmail.com", "zoho.com",
  "gmx.de", "web.de", "163.com", "qq.com", "naver.com",
];

// ── From users (mail accounts) ──
export const FROM_USERS = [
  "no-reply", "info", "support", "admin", "sales", "marketing",
  "newsletter", "billing", "alerts", "notifications", "contact",
  "dev", "ops", "hr", "finance", "hello",
];

export const EVENT_TYPES = ["accepted", "delivered", "bounced", "deferred", "complained"] as const;
export const BOUNCE_TYPES = ["hard", "soft"] as const;
export const BOUNCE_CATEGORIES = ["invalid-mailbox", "mailbox-full", "dns-error", "policy", "content", "other"] as const;
export const SPAM_ACTIONS = ["no action", "greylist", "add header", "reject", "soft reject"] as const;
