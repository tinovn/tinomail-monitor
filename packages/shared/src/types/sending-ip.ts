/** Sending IP entry in the registry */
export interface SendingIp {
  ip: string;
  ipVersion: 4 | 6;
  nodeId: string | null;
  subnet: string | null;
  ptrRecord: string | null;
  status: string;
  warmupStart: string | null;
  warmupDay: number;
  dailyLimit: number | null;
  currentDailySent: number;
  blacklistCount: number;
  reputationScore: number;
  lastBlacklistCheck: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Sending domain configuration */
export interface SendingDomain {
  domain: string;
  dkimConfigured: boolean;
  spfConfigured: boolean;
  dmarcConfigured: boolean;
  dmarcPolicy: string | null;
  status: string;
  dailyLimit: number | null;
  createdAt: Date;
}
