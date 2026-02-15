import { schema as Db } from "@repo/db";
import { betterAuth } from "better-auth";
import type { DB } from "better-auth/adapters/drizzle";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { anonymous } from "better-auth/plugins";
import { emailOTP } from "better-auth/plugins/email-otp";
import { sendOTP, sendPasswordReset, sendVerificationEmail } from "./email";
import type { Env } from "./env";

// Auth hint cookie for edge routing (see docs/adr/001-auth-hint-cookie.md)
// NOT a security boundary - false positives are acceptable (causes one redirect)
// __Host- prefix requires Secure; use plain name in HTTP dev
const AUTH_HINT_VALUE = "1";

type AuthEnv = Pick<
  Env,
  | "ENVIRONMENT"
  | "APP_NAME"
  | "APP_ORIGIN"
  | "BETTER_AUTH_SECRET"
  | "GOOGLE_CLIENT_ID"
  | "GOOGLE_CLIENT_SECRET"
  | "RESEND_API_KEY"
  | "RESEND_EMAIL_FROM"
>;

/**
 * Creates a Better Auth instance with email/password, Google OAuth, and anonymous auth.
 *
 * Uses custom 'identity' table instead of default 'account' model for OAuth accounts.
 * Delegates ID generation to application layer via @paralleldrive/cuid2 ($defaultFn).
 */
export function createAuth(
  db: DB,
  env: AuthEnv,
): ReturnType<typeof betterAuth> {
  return betterAuth({
    baseURL: `${env.APP_ORIGIN}/api/auth`,
    trustedOrigins: [env.APP_ORIGIN],
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "sqlite",

      schema: {
        identity: Db.identity,
        session: Db.session,
        user: Db.user,
        verification: Db.verification,
      },
    }),

    account: {
      modelName: "identity",
    },

    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url }) => {
        await sendPasswordReset(env, { user, url });
      },
    },

    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await sendVerificationEmail(env, { user, url });
      },
    },

    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },

    plugins: [
      anonymous(),
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          await sendOTP(env, { email, otp, type });
        },
        otpLength: 6,
        expiresIn: 300, // 5 minutes
        allowedAttempts: 3,
      }),
    ],

    advanced: {
      database: {
        generateId: false,
      },
    },

    // Set/clear auth hint cookie for edge routing
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        const isSecure = new URL(env.APP_ORIGIN).protocol === "https:";
        const cookieName = isSecure ? "__Host-auth" : "auth";
        const cookieOpts = {
          path: "/",
          secure: isSecure,
          httpOnly: true,
          sameSite: "lax" as const,
        };

        if (ctx.context.newSession) {
          ctx.setCookie(cookieName, AUTH_HINT_VALUE, cookieOpts);
          return;
        }

        if (ctx.path.startsWith("/sign-out")) {
          ctx.setCookie(cookieName, "", { ...cookieOpts, maxAge: 0 });
          return;
        }

        if (ctx.path === "/get-session" && !ctx.context.session) {
          const cookies = ctx.request?.headers.get("cookie") ?? "";
          const hasHintCookie = cookies
            .split(";")
            .some((c) => c.trim().startsWith(`${cookieName}=`));
          if (hasHintCookie) {
            ctx.setCookie(cookieName, "", { ...cookieOpts, maxAge: 0 });
          }
        }
      }),
    },
  });
}

export type Auth = ReturnType<typeof betterAuth>;

// Base session types from Better Auth - plugin-specific fields added at runtime
type SessionResponse = Auth["$Infer"]["Session"];
export type AuthUser = SessionResponse["user"];
export type AuthSession = SessionResponse["session"];
