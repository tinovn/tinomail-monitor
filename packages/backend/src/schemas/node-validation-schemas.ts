import { z } from "zod";

export const registerNodeSchema = z.object({
  nodeId: z.string().min(1).max(100),
  hostname: z.string().max(255),
  ipAddress: z.string().ip(),
  role: z.enum(["mongodb", "wildduck", "haraka", "zonemta", "rspamd"]),
  metadata: z.record(z.unknown()).optional(),
});

export const updateNodeMaintenanceSchema = z.object({
  maintenance: z.boolean(),
});

export type RegisterNodeInput = z.infer<typeof registerNodeSchema>;
export type UpdateNodeMaintenanceInput = z.infer<typeof updateNodeMaintenanceSchema>;
