import { z } from "zod";

/** Time range query schema for spam/security endpoints */
export const timeRangeQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

/** Auth event schema for agent ingestion */
export const authEventSchema = z.object({
  time: z.string().datetime(),
  nodeId: z.string(),
  username: z.string(),
  sourceIp: z.string().ip(),
  success: z.boolean(),
  failureReason: z.string().optional(),
});

/** Auth event ingestion - single or batch */
export const authEventIngestSchema = z.union([
  authEventSchema,
  z.array(authEventSchema),
]);

export type AuthEvent = z.infer<typeof authEventSchema>;
export type AuthEventIngest = z.infer<typeof authEventIngestSchema>;
