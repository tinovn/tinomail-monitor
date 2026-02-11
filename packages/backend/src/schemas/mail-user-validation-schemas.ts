import { z } from "zod";

/**
 * Query params for mail users list
 */
export const mailUserQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  search: z.string().optional(),
  sortBy: z.enum(["sent24h", "bounceRate", "spamReports"]).optional().default("sent24h"),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
});

/**
 * Mail user address route params
 */
export const mailUserParamsSchema = z.object({
  address: z.string().email(),
});

/**
 * Activity query params for mail user
 */
export const mailUserActivityQuerySchema = z.object({
  from: z.string().optional().default(() => {
    const date = new Date();
    date.setHours(date.getHours() - 24);
    return date.toISOString();
  }),
  to: z.string().optional().default(() => new Date().toISOString()),
});
