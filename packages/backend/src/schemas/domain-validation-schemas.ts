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
 * Query params for paginated domain list
 */
export const domainListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  sortBy: z.enum(["domain", "healthScore", "sent24h", "deliveredPercent", "bouncePercent"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

/**
 * Domain route params
 */
export const domainParamsSchema = z.object({
  domain: z.string().min(1),
});
