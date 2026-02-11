import { z } from "zod";

/** Log search query schema with all filter options */
export const logSearchQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  eventType: z.array(z.enum(["received", "delivered", "bounced", "deferred", "rejected", "sent"])).optional(),
  fromAddress: z.string().optional(),
  toAddress: z.string().optional(),
  fromDomain: z.string().optional(),
  toDomain: z.string().optional(),
  mtaNode: z.array(z.string()).optional(),
  sendingIp: z.string().optional(),
  messageId: z.string().optional(),
  queueId: z.string().optional(),
  statusCodeMin: z.coerce.number().int().min(0).max(999).optional(),
  statusCodeMax: z.coerce.number().int().min(0).max(999).optional(),
  bounceType: z.string().optional(),
  searchText: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** Message trace params */
export const messageTraceParamsSchema = z.object({
  messageId: z.string(),
});

/** Queue trace params */
export const queueTraceParamsSchema = z.object({
  queueId: z.string(),
});

/** Saved search body */
export const savedSearchBodySchema = z.object({
  name: z.string().min(1).max(100),
  config: z.object({
    filters: z.record(z.unknown()),
  }),
  isDefault: z.boolean().optional(),
});

/** Saved search ID params */
export const savedSearchIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type LogSearchQuery = z.infer<typeof logSearchQuerySchema>;
export type SavedSearchBody = z.infer<typeof savedSearchBodySchema>;
