type Env = Record<string, string | undefined>;

export type PasskeyRelyingParty = {
  rpID: string;
  rpName: string;
  origin: string[];
};

function read(env: Env, name: string) {
  const value = env[name]?.trim();
  return value || undefined;
}

function splitList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function hostnameOf(value: string | undefined) {
  if (!value) return undefined;
  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

/** WebAuthn only accepts an origin whose host is the RP ID or a subdomain of it. */
export function originMatchesRpID(origin: string, rpID: string) {
  const hostname = hostnameOf(origin);
  if (!hostname) return false;
  return hostname === rpID || hostname.endsWith(`.${rpID}`);
}

/**
 * Resolve the passkey relying party from env.
 *
 * - `PASSKEY_RP_ID` overrides the RP ID; otherwise it is the hostname of the
 *   dashboard base URL (`logly.localhost` locally, `logly-chi.vercel.app` in
 *   production).
 * - Expected origins are the base URL, `BETTER_AUTH_TRUSTED_ORIGINS` and
 *   `PASSKEY_ORIGINS`, kept only when they belong to the RP ID. Passing an
 *   explicit list stops the plugin from trusting the request's Origin header.
 */
export function resolvePasskeyRelyingParty(
  baseURL: string | undefined,
  env: Env = process.env,
): PasskeyRelyingParty {
  const rpID = (
    read(env, "PASSKEY_RP_ID") ??
    hostnameOf(baseURL) ??
    "localhost"
  ).toLowerCase();
  const candidates = [
    ...(baseURL ? [baseURL] : []),
    ...splitList(read(env, "BETTER_AUTH_TRUSTED_ORIGINS")),
    ...splitList(read(env, "PASSKEY_ORIGINS")),
  ];
  const origin = [
    ...new Set(
      candidates
        .map(toOrigin)
        .filter((value): value is string => Boolean(value))
        .filter((value) => originMatchesRpID(value, rpID)),
    ),
  ];
  return {
    rpID,
    rpName: read(env, "PASSKEY_RP_NAME") ?? "Logly",
    origin,
  };
}
