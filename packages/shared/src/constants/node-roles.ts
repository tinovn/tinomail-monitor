/** Server node roles in the mail infrastructure */
export const NODE_ROLES = [
  "zonemta-outbound",
  "zonemta-local",
  "wildduck",
  "haraka",
  "mongodb",
  "redis",
  "rspamd",
] as const;

export type NodeRole = (typeof NODE_ROLES)[number];

/** Node operational status */
export const NODE_STATUSES = ["active", "stopped", "maintenance", "blocked"] as const;

export type NodeStatus = (typeof NODE_STATUSES)[number];
