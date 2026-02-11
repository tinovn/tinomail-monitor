/** Default alert rules seeded into the system */
export const ALERT_RULES_SEED_DATA = [
  // Critical — immediate attention
  { name: "Node Down", severity: "critical", condition: "node_last_seen > 60s", threshold: 60, channels: ["telegram"], description: "Node hasn't reported in 60 seconds" },
  { name: "CPU Critical", severity: "critical", condition: "cpu_percent > threshold", threshold: 95, duration: "5 minutes", channels: ["telegram"], description: "CPU above 95% for 5 minutes" },
  { name: "RAM Critical", severity: "critical", condition: "ram_percent > threshold", threshold: 95, duration: "5 minutes", channels: ["telegram"], description: "RAM above 95% for 5 minutes" },
  { name: "Disk Critical", severity: "critical", condition: "disk_percent > threshold", threshold: 95, channels: ["telegram"], description: "Disk usage above 95%" },
  { name: "Bounce Rate Spike", severity: "critical", condition: "bounce_rate > threshold", threshold: 15, duration: "10 minutes", channels: ["telegram"], description: "Bounce rate above 15% for 10 minutes" },
  { name: "IP Blacklisted (Critical)", severity: "critical", condition: "ip_blacklisted_critical", threshold: 1, channels: ["telegram"], description: "IP listed on critical-tier blacklist" },
  { name: "Queue Overflow", severity: "critical", condition: "queue_size > threshold", threshold: 50000, duration: "5 minutes", channels: ["telegram"], description: "MTA queue exceeds 50K for 5 minutes" },

  // Warning — needs review
  { name: "CPU Warning", severity: "warning", condition: "cpu_percent > threshold", threshold: 80, duration: "10 minutes", channels: ["telegram"], description: "CPU above 80% for 10 minutes" },
  { name: "RAM Warning", severity: "warning", condition: "ram_percent > threshold", threshold: 80, duration: "10 minutes", channels: ["telegram"], description: "RAM above 80% for 10 minutes" },
  { name: "Disk Warning", severity: "warning", condition: "disk_percent > threshold", threshold: 85, channels: ["telegram"], description: "Disk usage above 85%" },
  { name: "Bounce Rate Warning", severity: "warning", condition: "bounce_rate > threshold", threshold: 8, duration: "15 minutes", channels: ["telegram"], description: "Bounce rate above 8% for 15 minutes" },
  { name: "IP Blacklisted (High)", severity: "warning", condition: "ip_blacklisted_high", threshold: 1, channels: ["telegram"], description: "IP listed on high-tier blacklist" },
  { name: "Delivery Time Slow", severity: "warning", condition: "avg_delivery_ms > threshold", threshold: 30000, duration: "10 minutes", channels: ["telegram"], description: "Avg delivery time above 30s for 10 minutes" },
  { name: "MongoDB Repl Lag", severity: "warning", condition: "repl_lag_seconds > threshold", threshold: 10, duration: "5 minutes", channels: ["telegram"], description: "MongoDB replication lag above 10s" },
  { name: "Queue Growing", severity: "warning", condition: "queue_size > threshold", threshold: 10000, duration: "15 minutes", channels: ["telegram"], description: "MTA queue above 10K for 15 minutes" },
  { name: "Redis Memory High", severity: "warning", condition: "redis_memory_percent > threshold", threshold: 80, channels: ["telegram"], description: "Redis memory usage above 80%" },
  { name: "High TCP Time-Wait", severity: "warning", condition: "tcp_time_wait > threshold", threshold: 5000, duration: "5 minutes", channels: ["telegram"], description: "TCP TIME_WAIT above 5000" },
  { name: "Warmup Daily Limit", severity: "warning", condition: "warmup_daily_limit_reached", threshold: 90, channels: ["telegram"], description: "IP approaching warmup daily send limit (90%)" },

  // Info — operational awareness
  { name: "Node Maintenance", severity: "info", condition: "node_status_changed", channels: ["telegram"], description: "Node status changed to/from maintenance" },
  { name: "IP Status Changed", severity: "info", condition: "ip_status_changed", channels: ["telegram"], description: "Sending IP status changed" },
  { name: "IP Delisted", severity: "info", condition: "ip_delisted", channels: ["telegram"], description: "IP removed from blacklist" },
  { name: "Abuse Detected", severity: "warning", condition: "abuse_pattern_detected", channels: ["telegram"], description: "Unusual sending pattern detected for a user" },
  { name: "Daily Report", severity: "info", condition: "scheduled_daily_report", channels: ["email"], description: "Daily summary report generated" },
] as const;
