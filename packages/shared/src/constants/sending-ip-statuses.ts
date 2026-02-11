/** Sending IP lifecycle statuses */
export const IP_STATUSES = [
  "active",
  "warming",
  "paused",
  "blacklisted",
  "retired",
] as const;

export type IpStatus = (typeof IP_STATUSES)[number];

/** DNSBL tier priority levels */
export const DNSBL_TIERS = ["critical", "high", "medium"] as const;

export type DnsblTier = (typeof DNSBL_TIERS)[number];
