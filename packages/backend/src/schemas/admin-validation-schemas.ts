import { z } from "zod";

export const dashboardUserBodySchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().optional(),
  password: z.string().min(8).max(100),
  role: z.enum(["admin", "operator", "viewer"]).default("viewer"),
});

export const dashboardUserUpdateSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(["admin", "operator", "viewer"]).optional(),
});

export const passwordResetSchema = z.object({
  newPassword: z.string().min(8).max(100),
});

export const settingsUpdateSchema = z.object({
  value: z.unknown(), // Can be any type based on setting
});

export const auditLogQuerySchema = z.object({
  user: z.string().optional(),
  action: z.enum(["create", "update", "delete"]).optional(),
  resource: z.enum(["node", "ip", "rule", "user", "setting"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type DashboardUserBodyInput = z.infer<typeof dashboardUserBodySchema>;
export type DashboardUserUpdateInput = z.infer<typeof dashboardUserUpdateSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;
