import { z } from "zod";

/** Email event validation schema - matches PRD Section 5.8 */
export const emailEventSchema = z.object({
  time: z.string().datetime(),
  eventType: z.enum([
    "received",
    "delivered",
    "bounced",
    "deferred",
    "rejected",
    "sent",
  ]),
  messageId: z.string().optional(),
  queueId: z.string().optional(),
  fromAddress: z.string().email().optional(),
  fromUser: z.string().optional(),
  fromDomain: z.string().optional(),
  toAddress: z.string().email().optional(),
  toDomain: z.string().optional(),
  mtaNode: z.string().optional(),
  sendingIp: z.string().ip({ version: "v4" }).optional(),
  sendingIpV6: z.string().ip({ version: "v6" }).optional(),
  mxHost: z.string().optional(),
  statusCode: z.number().int().min(0).max(999).optional(),
  statusMessage: z.string().max(500).optional(),
  deliveryTimeMs: z.number().int().nonnegative().optional(),
  queueTimeMs: z.number().int().nonnegative().optional(),
  totalTimeMs: z.number().int().nonnegative().optional(),
  bounceType: z.string().optional(),
  bounceCategory: z.string().optional(),
  bounceMessage: z.string().max(500).optional(),
  messageSize: z.number().int().nonnegative().optional(),
  dkimResult: z.enum(["pass", "fail", "none", "policy"]).optional(),
  spfResult: z.enum(["pass", "fail", "softfail", "neutral", "none"]).optional(),
  dmarcResult: z.enum(["pass", "fail", "none"]).optional(),
  spamScore: z.number().optional(),
  spamAction: z.enum(["accept", "reject", "greylist", "soft_reject"]).optional(),
});

/** Accept single event or array of events */
export const emailEventIngestSchema = z.union([
  emailEventSchema,
  z.array(emailEventSchema),
]);

export type EmailEvent = z.infer<typeof emailEventSchema>;
export type EmailEventIngest = z.infer<typeof emailEventIngestSchema>;
