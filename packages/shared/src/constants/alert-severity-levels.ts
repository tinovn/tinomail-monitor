/** Alert severity levels */
export const SEVERITY_LEVELS = ["critical", "warning", "info"] as const;

export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

/** Alert event statuses */
export const ALERT_STATUSES = ["firing", "resolved"] as const;

export type AlertStatus = (typeof ALERT_STATUSES)[number];

/** Notification channels */
export const NOTIFICATION_CHANNELS = ["telegram", "slack", "email"] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
