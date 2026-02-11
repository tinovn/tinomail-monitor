import { z } from "zod";

/**
 * Query params for destination analysis time range
 */
export const destinationQuerySchema = z.object({
  from: z.string().optional().default(() => {
    const date = new Date();
    date.setHours(date.getHours() - 24);
    return date.toISOString();
  }),
  to: z.string().optional().default(() => new Date().toISOString()),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50),
});

/**
 * Destination domain route params
 */
export const destinationParamsSchema = z.object({
  domain: z.string().min(1),
});
