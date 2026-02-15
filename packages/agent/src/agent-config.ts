import { z } from "zod";

/** Bump this on each agent release */
export const AGENT_VERSION = "0.4.1";

const envSchema = z.object({
  AGENT_SERVER_URL: z.string().default("http://localhost:3001"),
  AGENT_API_KEY: z.string().default("change-me-in-production"),
  AGENT_NODE_ID: z.string().default("node-01"),
  AGENT_NODE_ROLE: z.string().default("auto"),
  AGENT_HEARTBEAT_INTERVAL: z.coerce.number().default(15000),
  AGENT_MONGODB_URI: z.string().optional(),
  AGENT_MONGODB_INTERVAL: z.coerce.number().default(30000),
  AGENT_ZONEMTA_API_URL: z.string().default("http://localhost:12080"),
  AGENT_ZONEMTA_MONGODB_URI: z.string().optional(),
  AGENT_REDIS_URL: z.string().default("redis://localhost:6379"),
  AGENT_DISCOVERY_INTERVAL: z.coerce.number().default(300000),
});

export type AgentConfig = z.infer<typeof envSchema>;

export function loadAgentConfig(): AgentConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid agent config:", result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}
