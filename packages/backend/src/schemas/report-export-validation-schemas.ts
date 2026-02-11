import { z } from "zod";

export const reportQuerySchema = z.object({
  date: z.string().optional(), // YYYY-MM-DD for daily
  week: z.string().optional(), // YYYY-Www for weekly
  month: z.string().optional(), // YYYY-MM for monthly
});

export const exportQuerySchema = z.object({
  format: z.enum(["csv", "json"]).default("csv"),
  from: z.string(), // ISO date string
  to: z.string(), // ISO date string
  nodeId: z.coerce.number().int().optional(),
  eventType: z.string().optional(),
  status: z.string().optional(),
  severity: z.string().optional(),
});

export const reportGenerationSchema = z.object({
  type: z.enum(["daily", "weekly", "monthly", "ip-reputation"]),
  date: z.string().optional(),
  emailTo: z.array(z.string().email()).optional(),
});

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
export type ExportQueryInput = z.infer<typeof exportQuerySchema>;
export type ReportGenerationInput = z.infer<typeof reportGenerationSchema>;
