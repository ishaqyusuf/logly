import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { getRequiredDatabase } from "@logly/db/client";
import * as schema from "@logly/db/schema";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function unique(values: Array<string | undefined>) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

function getBaseUrl() {
  const vercelUrl = readEnv("VERCEL_URL");
  return (
    readEnv("BETTER_AUTH_URL") ??
    readEnv("NEXT_PUBLIC_DASHBOARD_URL") ??
    (vercelUrl ? `https://${vercelUrl}` : undefined) ??
    (process.env.NEXT_PHASE === "phase-production-build"
      ? "http://localhost:4101"
      : undefined) ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : "http://localhost:4101")
  );
}

function getSecret() {
  const configured = readEnv("BETTER_AUTH_SECRET");
  if (configured) return configured;
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return "logly-build-only-auth-secret-not-for-runtime";
  }
  if (process.env.NODE_ENV !== "production") {
    return "logly-local-development-auth-secret";
  }
  throw new Error("BETTER_AUTH_SECRET is required in production");
}

export function getTrustedOrigins() {
  return unique([
    "http://localhost:4101",
    "http://127.0.0.1:4101",
    getBaseUrl(),
    ...(readEnv("BETTER_AUTH_TRUSTED_ORIGINS") ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ]);
}

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: getBaseUrl(),
  database: drizzleAdapter(getRequiredDatabase(), {
    provider: "pg",
    schema,
  }),
  disableSignUp: true,
  emailAndPassword: {
    enabled: true,
    maxPasswordLength: 128,
    minPasswordLength: 6,
    requireEmailVerification: false,
  },
  plugins: [admin()],
  secret: getSecret(),
  telemetry: { enabled: false },
  trustedOrigins: getTrustedOrigins(),
});

export type AuthSession = typeof auth.$Infer.Session;
