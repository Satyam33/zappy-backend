import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().url(),
  CORS_ORIGINS: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive(),
  REDIS_PASSWORD: z.string().optional(),
  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(10).default("change-me-refresh-secret"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  OTP_EXPIRY_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  WEBHOOK_VERIFY_TOKEN: z.string().min(1).default("zappy-webhook-token"),
  META_GRAPH_VERSION: z.string().default("v22.0")
});

export const env = EnvSchema.parse(process.env);
