import { z } from "zod";

/**
 * Query params for domain stats time range
 */
export const domainStatsQuerySchema = z.object({
  from: z.string().optional().default(() => {
    const date = new Date();
    date.setHours(date.getHours() - 24);
    return date.toISOString();
  }),
  to: z.string().optional().default(() => new Date().toISOString()),
});

/**
 * Domain route params
 */
export const domainParamsSchema = z.object({
  domain: z.string().min(1),
});
