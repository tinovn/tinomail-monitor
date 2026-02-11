import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // Database
  DATABASE_URL: z
    .string()
    .default("postgres://tinomail:devpassword@localhost:5432/tinomail_monitor"),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // JWT
  JWT_SECRET: z.string().default("change-me-in-production"),
  JWT_EXPIRES_IN: z.string().default("24h"),

  // Agent
  AGENT_API_KEY: z.string().default("change-me-in-production"),

  // CORS
  CORS_ORIGIN: z.string().optional(),
});

export type ServerConfig = z.infer<typeof envSchema>;

const INSECURE_DEFAULTS = ["change-me-in-production", "devpassword"];

export function loadConfig(): ServerConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:", result.error.flatten().fieldErrors);
    process.exit(1);
  }

  const config = result.data;

  // Block insecure defaults in production
  if (config.NODE_ENV === "production") {
    if (INSECURE_DEFAULTS.includes(config.JWT_SECRET)) {
      console.error("FATAL: JWT_SECRET must be set to a secure value in production");
      process.exit(1);
    }
    if (INSECURE_DEFAULTS.some((d) => config.DATABASE_URL.includes(d))) {
      console.error("FATAL: DATABASE_URL contains insecure default credentials in production");
      process.exit(1);
    }
  }

  return config;
}
