import { z } from "zod";

export const updateIpStatusSchema = z.object({
  status: z.enum(["active", "paused", "quarantine", "retired"]),
  notes: z.string().optional(),
});

export const bulkIpActionSchema = z.object({
  ips: z.array(z.string().ip()),
  action: z.enum(["activate", "pause", "quarantine", "retire"]),
  notes: z.string().optional(),
});

export const updateIpWarmupSchema = z.object({
  warmupStart: z.string().optional(),
  warmupDay: z.number().int().min(0).max(90).optional(),
  dailyLimit: z.number().int().min(0).optional(),
});

export const createIpPoolSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["transactional", "marketing", "notification", "general"]),
  ips: z.array(z.string().ip()).default([]),
  description: z.string().optional(),
});

export const updateIpPoolSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["transactional", "marketing", "notification", "general"]).optional(),
  ips: z.array(z.string().ip()).optional(),
  description: z.string().optional(),
});

export const addIpRangeSchema = z.object({
  cidr: z.string().regex(/^(?:\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/),
  nodeId: z.string(),
  subnet: z.string().optional(),
});

export type UpdateIpStatusInput = z.infer<typeof updateIpStatusSchema>;
export type BulkIpActionInput = z.infer<typeof bulkIpActionSchema>;
export type UpdateIpWarmupInput = z.infer<typeof updateIpWarmupSchema>;
export type CreateIpPoolInput = z.infer<typeof createIpPoolSchema>;
export type UpdateIpPoolInput = z.infer<typeof updateIpPoolSchema>;
export type AddIpRangeInput = z.infer<typeof addIpRangeSchema>;
