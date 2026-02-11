/** Result of a DNSBL check for a single IP against one blacklist */
export interface BlacklistCheck {
  time: Date;
  ip: string;
  ipVersion: 4 | 6;
  nodeId: string | null;
  blacklist: string;
  tier: string | null;
  listed: boolean;
  response: string | null;
  checkDurationMs: number | null;
}
