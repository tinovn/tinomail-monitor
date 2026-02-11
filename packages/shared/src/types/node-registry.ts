/** Registered monitoring node (self-registers on agent startup) */
export interface Node {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  role: string;
  status: string;
  registeredAt: Date;
  lastSeen: Date | null;
  metadata: Record<string, unknown> | null;
}

/** Payload sent by agent on registration/heartbeat */
export interface NodeRegistrationPayload {
  nodeId: string;
  hostname: string;
  ipAddress: string;
  role: string;
  metadata?: Record<string, unknown>;
}
