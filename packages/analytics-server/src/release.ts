import { createHmac } from "node:crypto";

export type LoglyReleaseEnvironment = "production" | "preview";

export type LoglyReleaseInput = {
  /** Version or commit SHA; 1-100 characters, no spaces. */
  version: string;
  /** Defaults to `production`. */
  environment?: LoglyReleaseEnvironment;
  /** ISO 8601 timestamp or Date; defaults to now. Up to 365 days back. */
  deployedAt?: string | Date;
  /** Up to 280 characters, shown in the marker tooltip. */
  description?: string;
  /** http(s) link to the deploy, commit or changelog; up to 500 characters. */
  url?: string;
};

export type LoglyRelease = {
  id: string;
  environment: LoglyReleaseEnvironment;
  version: string;
  deployedAt: string;
  description: string | null;
  url: string | null;
  source: "api" | "dashboard";
};

export type LoglyReleaseResult = {
  /** False when this project, environment and version was already recorded. */
  created: boolean;
  release: LoglyRelease;
};

export type LoglyReleaseConfig = {
  project: string;
  collectorUrl: string;
  /** A `server-write` project key. */
  serverKey: string;
  timeoutMs?: number;
};

/**
 * Record a deploy marker with `POST /v1/releases`. Idempotent on project,
 * environment and version, so CI retries are safe.
 */
export async function sendRelease(
  config: LoglyReleaseConfig,
  input: LoglyReleaseInput,
): Promise<LoglyReleaseResult> {
  const body = JSON.stringify({
    project: config.project,
    version: input.version,
    environment: input.environment ?? "production",
    deployedAt:
      input.deployedAt instanceof Date
        ? input.deployedAt.toISOString()
        : input.deployedAt,
    description: input.description?.slice(0, 280),
    url: input.url,
  });
  const response = await fetch(
    `${config.collectorUrl.replace(/\/$/, "")}/v1/releases`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.serverKey}`,
        "x-logly-signature": createHmac("sha256", config.serverKey)
          .update(body)
          .digest("hex"),
      },
      body,
      signal: AbortSignal.timeout(config.timeoutMs ?? 4000),
    },
  );
  if (!response.ok) {
    const detail = await response
      .json()
      .then((value: { error?: string }) => value.error)
      .catch(() => undefined);
    throw new Error(
      `Logly collector returned ${response.status}${detail ? `: ${detail}` : ""}`,
    );
  }
  return response.json() as Promise<LoglyReleaseResult>;
}

type Env = Record<string, string | undefined>;

/**
 * Derive a release from CI environment variables (Vercel, then GitHub
 * Actions, then `LOGLY_RELEASE_*` overrides). Returns null on Vercel
 * development builds or when no version is available.
 */
export function releaseFromEnvironment(env: Env): LoglyReleaseInput | null {
  if (env.VERCEL_ENV === "development") return null;
  const version =
    env.LOGLY_RELEASE_VERSION ??
    env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
    env.GITHUB_SHA?.slice(0, 12);
  if (!version) return null;
  const environment =
    env.LOGLY_RELEASE_ENVIRONMENT === "preview" ||
    env.LOGLY_RELEASE_ENVIRONMENT === "production"
      ? env.LOGLY_RELEASE_ENVIRONMENT
      : env.VERCEL_ENV === "preview"
        ? "preview"
        : "production";
  const description =
    env.LOGLY_RELEASE_DESCRIPTION ??
    env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0];
  const githubCommit =
    env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_SHA
      ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/commit/${env.GITHUB_SHA}`
      : undefined;
  const url =
    env.LOGLY_RELEASE_URL ??
    (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : githubCommit);
  return {
    version,
    environment,
    ...(description ? { description: description.slice(0, 280) } : {}),
    ...(url ? { url } : {}),
  };
}
