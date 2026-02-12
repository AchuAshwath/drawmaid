import { z } from "zod";

/**
 * Zod schema for validating environment variables.
 */
export const envSchema = z.object({
  ENVIRONMENT: z.enum(["production", "staging", "preview", "development"]),
  APP_NAME: z.string().default("Example"),
  APP_ORIGIN: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  OPENAI_API_KEY: z.string(),
  RESEND_API_KEY: z.string(),
  RESEND_EMAIL_FROM: z.email(),
});

/**
 * Runtime environment variables accessor.
 */
export const env =
  typeof Bun === "undefined" ? ({} as Env) : envSchema.parse(Bun.env);

export type Env = z.infer<typeof envSchema>;
