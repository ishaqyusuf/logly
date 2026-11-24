/**
 * Deploy markers: product releases recorded per project and drawn on the
 * dashboard's time-series charts.
 */

export const RELEASE_ENVIRONMENTS = ["production", "preview"] as const;
export type ReleaseEnvironment = (typeof RELEASE_ENVIRONMENTS)[number];
export type ReleaseSource = "api" | "dashboard";

/** Largest accepted `POST /v1/releases` body. */
export const RELEASE_MAX_BODY_BYTES = 4_096;
export const RELEASE_MAX_VERSION_LENGTH = 100;
export const RELEASE_MAX_DESCRIPTION_LENGTH = 280;
export const RELEASE_MAX_URL_LENGTH = 500;
/** Oldest `deployedAt` accepted, so a release can be backfilled. */
export const RELEASE_MAX_AGE_DAYS = 365;
/** Allowed clock skew for a `deployedAt` in the future. */
export const RELEASE_MAX_FUTURE_MS = 5 * 60_000;
/** Most releases one read returns. */
export const RELEASE_LIST_LIMIT = 200;

/** A version string or commit SHA: no spaces, no control characters. */
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\-+/:@]*$/;

export type AnalyticsRelease = {
  id: string;
  environment: ReleaseEnvironment;
  version: string;
  deployedAt: string;
  description: string | null;
  url: string | null;
  source: ReleaseSource;
};

export type ReleaseInput = {
  project: string;
  environment: ReleaseEnvironment;
  version: string;
  deployedAt: Date;
  description: string | null;
  url: string | null;
};

export type ReleaseInputResult =
  | { ok: true; data: ReleaseInput }
  | { ok: false; error: string };

export function isReleaseEnvironment(
  value: unknown,
): value is ReleaseEnvironment {
  return RELEASE_ENVIRONMENTS.includes(value as ReleaseEnvironment);
}

function optionalText(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Validate a release body from the collector or the dashboard. `environment`
 * defaults to production and `deployedAt` to now.
 */
export function parseReleaseInput(
  value: unknown,
  now = new Date(),
): ReleaseInputResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Release must be a JSON object" };
  }
  const body = value as Record<string, unknown>;

  const project = typeof body.project === "string" ? body.project.trim() : "";
  if (!project || project.length > 120) {
    return { ok: false, error: "project is required" };
  }

  const version = typeof body.version === "string" ? body.version.trim() : "";
  if (
    !version ||
    version.length > RELEASE_MAX_VERSION_LENGTH ||
    !VERSION_PATTERN.test(version)
  ) {
    return {
      ok: false,
      error: `version must be 1-${RELEASE_MAX_VERSION_LENGTH} characters with no spaces`,
    };
  }

  const environment = body.environment ?? "production";
  if (!isReleaseEnvironment(environment)) {
    return { ok: false, error: "environment must be production or preview" };
  }

  let deployedAt = now;
  if (body.deployedAt !== undefined && body.deployedAt !== null) {
    deployedAt =
      typeof body.deployedAt === "string"
        ? new Date(body.deployedAt)
        : new Date(Number.NaN);
    if (Number.isNaN(deployedAt.getTime())) {
      return { ok: false, error: "deployedAt must be an ISO 8601 timestamp" };
    }
    if (deployedAt.getTime() > now.getTime() + RELEASE_MAX_FUTURE_MS) {
      return { ok: false, error: "deployedAt cannot be in the future" };
    }
    if (
      deployedAt.getTime() <
      now.getTime() - RELEASE_MAX_AGE_DAYS * 86_400_000
    ) {
      return {
        ok: false,
        error: `deployedAt must be within the last ${RELEASE_MAX_AGE_DAYS} days`,
      };
    }
  }

  const description = optionalText(body.description);
  if (
    description === undefined ||
    (description && description.length > RELEASE_MAX_DESCRIPTION_LENGTH)
  ) {
    return {
      ok: false,
      error: `description must be text up to ${RELEASE_MAX_DESCRIPTION_LENGTH} characters`,
    };
  }

  const url = optionalText(body.url);
  if (url === undefined || (url && !isReleaseUrl(url))) {
    return {
      ok: false,
      error: `url must be an http(s) URL up to ${RELEASE_MAX_URL_LENGTH} characters`,
    };
  }

  return {
    ok: true,
    data: { project, environment, version, deployedAt, description, url },
  };
}

function isReleaseUrl(value: string) {
  if (value.length > RELEASE_MAX_URL_LENGTH) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** The chart bucket a timestamp falls in (UTC), matching the trend keys. */
export function releaseBucketKey(
  deployedAt: string,
  granularity: "hour" | "day",
) {
  const iso = new Date(deployedAt).toISOString();
  return granularity === "hour"
    ? `${iso.slice(0, 13)}:00:00Z`
    : iso.slice(0, 10);
}

/**
 * Group releases by the chart bucket they fall in. Releases outside the given
 * buckets are dropped; each bucket lists its releases oldest first.
 */
export function groupReleasesByBucket<T extends { deployedAt: string }>(
  releases: T[],
  buckets: string[],
  granularity: "hour" | "day",
) {
  const known = new Set(buckets);
  const grouped = new Map<string, T[]>();
  const sorted = [...releases].sort((left, right) =>
    left.deployedAt.localeCompare(right.deployedAt),
  );
  for (const release of sorted) {
    const key = releaseBucketKey(release.deployedAt, granularity);
    if (!known.has(key)) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), release]);
  }
  return grouped;
}
