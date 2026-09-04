const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function slugifyProjectName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64)
    .replace(/-$/g, "");
}

export type CreateProjectInput = {
  name: string;
  slug: string;
  allowedOrigins: string[];
  eventCatalog: string[];
  organizationId?: string;
};

function normalizeAllowedOrigin(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1")
      )
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function parseCreateProjectInput(
  value: unknown,
):
  | { success: true; data: CreateProjectInput }
  | { success: false; error: string } {
  if (!value || typeof value !== "object") {
    return { success: false, error: "Invalid project payload" };
  }
  const input = value as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const organizationId =
    typeof input.organizationId === "string" ? input.organizationId.trim() : "";
  const requestedSlug = typeof input.slug === "string" ? input.slug.trim() : "";
  const slug = requestedSlug || slugifyProjectName(name);
  const originValue =
    typeof input.allowedOrigins === "string"
      ? input.allowedOrigins
      : typeof input.allowedOrigin === "string"
        ? input.allowedOrigin
        : "";
  const rawOrigins = [
    ...new Set(
      originValue
        .split(/[\s,]+/)
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  ];
  const normalizedOrigins = rawOrigins.map(normalizeAllowedOrigin);
  const allowedOrigins = [
    ...new Set(normalizedOrigins.filter((origin) => origin !== null)),
  ];
  if (name.length < 2 || name.length > 80) {
    return { success: false, error: "Project name must be 2–80 characters" };
  }
  if (!slugPattern.test(slug)) {
    return {
      success: false,
      error: "Project name must produce a valid lowercase slug",
    };
  }
  if (
    rawOrigins.length === 0 ||
    rawOrigins.length > 10 ||
    normalizedOrigins.some((origin) => origin === null)
  ) {
    return {
      success: false,
      error: "Enter 1–10 valid HTTPS production origins",
    };
  }
  return {
    success: true,
    data: {
      name,
      slug,
      allowedOrigins,
      eventCatalog: [],
      ...(organizationId ? { organizationId } : {}),
    },
  };
}
