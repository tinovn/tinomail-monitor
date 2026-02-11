/** Alert rule definition */
export interface AlertRule {
  id: number;
  name: string;
  description: string | null;
  severity: string;
  condition: string;
  threshold: number | null;
  duration: string | null;
  channels: string[];
  enabled: boolean;
  cooldown: string;
  createdAt: Date;
}

/** Alert event fired when a rule triggers */
export interface AlertEvent {
  id: number;
  ruleId: number;
  severity: string;
  status: string;
  message: string | null;
  details: Record<string, unknown> | null;
  nodeId: string | null;
  firedAt: Date;
  resolvedAt: Date | null;
  notified: boolean;
}
