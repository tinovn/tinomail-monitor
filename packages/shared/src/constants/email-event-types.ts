/** All possible email event types */
export const EMAIL_EVENT_TYPES = [
  "delivered",
  "bounced",
  "deferred",
  "rejected",
  "received",
] as const;

export type EmailEventType = (typeof EMAIL_EVENT_TYPES)[number];
