/** Individual email event tracked per message */
export interface EmailEvent {
  time: Date;
  eventType: string;
  messageId: string | null;
  queueId: string | null;
  fromAddress: string | null;
  fromUser: string | null;
  fromDomain: string | null;
  toAddress: string | null;
  toDomain: string | null;
  mtaNode: string | null;
  sendingIp: string | null;
  sendingIpV6: string | null;
  mxHost: string | null;
  statusCode: number | null;
  statusMessage: string | null;
  deliveryTimeMs: number | null;
  queueTimeMs: number | null;
  totalTimeMs: number | null;
  bounceType: string | null;
  bounceCategory: string | null;
  bounceMessage: string | null;
  messageSize: number | null;
  dkimResult: string | null;
  spfResult: string | null;
  dmarcResult: string | null;
  spamScore: number | null;
  spamAction: string | null;
}
