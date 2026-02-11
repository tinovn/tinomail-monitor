import { z } from "zod";

export const alertRuleBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  severity: z.enum(["critical", "warning", "info"]),
  condition: z.string().min(1),
  threshold: z.number().optional(),
  duration: z.string().optional(),
  channels: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
  cooldown: z.string().default("30 minutes"),
});

export const alertActionBodySchema = z.object({
  duration: z.enum(["1h", "4h", "24h"]),
});

export const notificationChannelBodySchema = z.object({
  type: z.enum(["telegram", "slack", "email", "webhook", "inapp"]),
  name: z.string().min(1).max(255),
  config: z.record(z.unknown()),
  enabled: z.boolean().default(true),
});

export const alertHistoryQuerySchema = z.object({
  severity: z.enum(["critical", "warning", "info"]).optional(),
  ruleId: z.coerce.number().int().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type AlertRuleBodyInput = z.infer<typeof alertRuleBodySchema>;
export type AlertActionBodyInput = z.infer<typeof alertActionBodySchema>;
export type NotificationChannelBodyInput = z.infer<typeof notificationChannelBodySchema>;
export type AlertHistoryQueryInput = z.infer<typeof alertHistoryQuerySchema>;
