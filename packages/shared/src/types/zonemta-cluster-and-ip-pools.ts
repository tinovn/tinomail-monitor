/** IP Pool configuration */
export interface IpPool {
  id: number;
  name: string;
  type: string;
  ips: string[];
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** MTA node with aggregated stats for cluster overview */
export interface MtaNodeStats {
  nodeId: string;
  hostname: string | null;
  status: string;
  subnet: string | null;
  totalIps: number;
  activeIps: number;
  sentLastHour: number;
  bounceRate: number;
  queueSize: number;
  blacklistedIps: number;
  cpuUsage: number | null;
  lastSeen: Date | null;
}

/** Performance metrics for a specific MTA node */
export interface MtaNodePerformance {
  throughput: Array<{ time: Date; sent: number; delivered: number; bounced: number }>;
  deliveryStatus: { delivered: number; bounced: number; deferred: number; rejected: number };
  queueTrend: Array<{ time: Date; size: number }>;
  resources: {
    cpuUsage: number;
    memUsage: number;
    networkSent: number;
    networkRecv: number;
  };
}

/** Enriched IP address with stats */
export interface EnrichedSendingIp {
  ip: string;
  ipVersion: 4 | 6;
  nodeId: string | null;
  status: string;
  sentLast1h: number;
  sentLast24h: number;
  bounceRate: number;
  blacklists: string[];
  warmupDay: number;
  dailyLimit: number | null;
  currentDailySent: number;
  reputationScore: number;
  ptrRecord: string | null;
  lastUsed: Date | null;
}

/** Destination quality breakdown for a node */
export interface DestinationQuality {
  destination: string;
  sent: number;
  delivered: number;
  bounced: number;
  deferred: number;
  deliveryRate: number;
  avgDeliveryTime: number | null;
}
