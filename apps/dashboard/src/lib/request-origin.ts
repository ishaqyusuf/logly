function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isTrustedSameOrigin(request: Request) {
  const origin = normalizeOrigin(request.headers.get("origin"));
  if (!origin) return false;

  const requestOrigin = normalizeOrigin(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto") ?? "https";
  const forwardedOrigin = forwardedHost
    ? normalizeOrigin(`${forwardedProtocol}://${forwardedHost}`)
    : null;
  const configuredOrigins = [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_DASHBOARD_URL,
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(","),
  ]
    .map((value) => normalizeOrigin(value?.trim()))
    .filter((value): value is string => Boolean(value));

  return [requestOrigin, forwardedOrigin, ...configuredOrigins].includes(
    origin,
  );
}
