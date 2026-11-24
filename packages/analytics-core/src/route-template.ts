/**
 * Route templates turn concrete paths into page names that are safe to store
 * and useful to group, e.g. `/orders/04512AB/edit?tab=1` → `/orders/:id/edit`.
 * They run in the SDK, so record ids, slugs and tokens never leave the device.
 */
export type RouteTemplateOptions = {
  /**
   * Path prefixes whose remainder carries a token, shared link or payment
   * reference. Only the prefix is recorded, e.g. `"/checkout"` or
   * `"/sales/accept-quote"`.
   */
  redactPrefixes?: readonly string[];
  /**
   * Segments whose next segment is always a record id or slug, even when it
   * looks like a word, e.g. `"projects"` for `/projects/oak-ridge`. Version
   * segments such as `v2` between them are skipped.
   */
  idParents?: readonly string[];
  /** Segments that are never replaced, e.g. `"2fa"`. */
  keep?: readonly string[];
  /** Deeper segments are dropped. Defaults to 6. */
  maxSegments?: number;
};

export type RouteNormalizer = (route: string) => string;

export const ROUTE_ID_PLACEHOLDER = ":id";

const DEFAULT_MAX_SEGMENTS = 6;
const MAX_ROUTE_LENGTH = 256;
const MAX_STATIC_SEGMENT_LENGTH = 40;
const versionSegment = /^v\d{1,2}$/i;
const wordSegment = /^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)*$/i;
const uuidSegment =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function splitPath(route: string) {
  return (route.split(/[?#]/, 1)[0] ?? "").split("/").filter(Boolean);
}

function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function looksLikeId(segment: string) {
  if (versionSegment.test(segment)) return false;
  if (uuidSegment.test(segment)) return true;
  if (segment.length > MAX_STATIC_SEGMENT_LENGTH) return true;
  if ((segment.match(/\d/g)?.length ?? 0) >= 3) return true;
  return !wordSegment.test(segment);
}

function normalizePrefixes(prefixes: readonly string[] = []) {
  return prefixes
    .map((prefix) => splitPath(prefix).map((part) => part.toLowerCase()))
    .filter((parts) => parts.length > 0)
    .sort((a, b) => b.length - a.length);
}

function lowerSet(values: readonly string[] = []) {
  return new Set(values.map((value) => value.toLowerCase()));
}

export function createRouteNormalizer(
  options: RouteTemplateOptions = {},
): RouteNormalizer {
  const redactPrefixes = normalizePrefixes(options.redactPrefixes);
  const idParents = lowerSet(options.idParents);
  const keep = lowerSet(options.keep);
  const maxSegments = Math.max(
    1,
    Math.min(32, options.maxSegments ?? DEFAULT_MAX_SEGMENTS),
  );

  return (route) => {
    let segments = splitPath(route).map(decodeSegment);
    const lowered = segments.map((segment) => segment.toLowerCase());
    const prefix = redactPrefixes.find((parts) =>
      parts.every((part, index) => lowered[index] === part),
    );
    if (prefix) segments = segments.slice(0, prefix.length);

    const template: string[] = [];
    let parent: string | undefined;
    for (const segment of segments) {
      if (template.length >= maxSegments) break;
      const key = segment.toLowerCase();
      const isId =
        !keep.has(key) &&
        !versionSegment.test(segment) &&
        ((parent !== undefined && idParents.has(parent)) ||
          looksLikeId(segment));
      template.push(isId ? ROUTE_ID_PLACEHOLDER : segment);
      if (!versionSegment.test(segment)) parent = key;
    }
    return `/${template.join("/")}`.slice(0, MAX_ROUTE_LENGTH);
  };
}

/** The default normalizer: ids, slugs with numbers, UUIDs and long tokens. */
export const normalizeRoute: RouteNormalizer = createRouteNormalizer();
