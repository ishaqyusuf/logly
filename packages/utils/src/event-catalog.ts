import type { AnalyticsEventRow } from "./index";

/**
 * Event catalog (feature 7): one row per event name a project sends, with
 * first/last seen, range volume and trend, sources, sampled property keys,
 * an active/stale status and operator metadata. Metadata never renames,
 * merges or deletes event data; `hidden` only drops a name from pickers.
 *
 * `summarizeEventCatalog` is the in-memory specification the SQL query in
 * `@logly/db` must match.
 */

export type EventCatalogRange = "24h" | "7d" | "30d";
export const EVENT_CATALOG_RANGES: Record<
  EventCatalogRange,
  { buckets: number; bucketMs: number }
> = {
  "24h": { buckets: 24, bucketMs: 3_600_000 },
  "7d": { buckets: 7, bucketMs: 86_400_000 },
  "30d": { buckets: 30, bucketMs: 86_400_000 },
};
export const EVENT_CATALOG_STALE_DAYS = [7, 14, 30, 90] as const;
export type EventCatalogStaleDays = (typeof EVENT_CATALOG_STALE_DAYS)[number];
export const EVENT_CATALOG_DEFAULT_STALE_DAYS: EventCatalogStaleDays = 14;
/** Names listed per project; the rest are dropped and `truncated` is set. */
export const EVENT_CATALOG_MAX_EVENTS = 500;
/** Metadata rows kept per project. */
export const EVENT_CATALOG_MAX_METADATA = 1_000;
/** Latest events per name sampled for sources and property keys. */
export const EVENT_CATALOG_SAMPLE_PER_NAME = 100;
export const EVENT_CATALOG_DESCRIPTION_MAX = 280;
export const EVENT_CATALOG_NOTES_MAX = 500;
export const EVENT_CATALOG_MAX_BODY_BYTES = 4_096;

export type EventCatalogSource = "browser" | "mobile" | "server";
const SOURCE_ORDER: EventCatalogSource[] = ["browser", "mobile", "server"];

export type EventCatalogSimilarReason =
  | "separators"
  | "word_order"
  | "suffix"
  | "typo";

export type EventCatalogSimilar = {
  name: string;
  reason: EventCatalogSimilarReason;
};

export type EventCatalogMetadata = {
  name: string;
  description: string;
  notes: string;
  deprecated: boolean;
  hidden: boolean;
  updatedAt: string | null;
};

export type EventCatalogEntry = EventCatalogMetadata & {
  firstSeen: string | null;
  lastSeen: string | null;
  count: number;
  previousCount: number;
  /** Counts per bucket of the selected range, oldest first. */
  trend: number[];
  sources: EventCatalogSource[];
  properties: string[];
  status: "active" | "stale";
  /** Likely duplicates or typos among this project's names. Hints only. */
  similar: EventCatalogSimilar[];
};

export type AnalyticsEventCatalog = {
  project: string;
  range: EventCatalogRange;
  staleDays: EventCatalogStaleDays;
  start: string;
  end: string;
  bucketMs: number;
  events: EventCatalogEntry[];
  /** More than `EVENT_CATALOG_MAX_EVENTS` names exist; the rest are omitted. */
  truncated: boolean;
};

export type EventCatalogQuery = {
  project: string;
  organization?: string;
  range: EventCatalogRange;
  staleDays: EventCatalogStaleDays;
};

/** Names flagged for pickers: hidden ones drop out, deprecated get a badge. */
export type EventCatalogFlags = { deprecated: string[]; hidden: string[] };

export type EventCatalogInput = {
  project: string;
  name: string;
  description: string;
  notes: string;
  deprecated: boolean;
  hidden: boolean;
};

const PROJECT = /^[a-z0-9-]{2,64}$/;
const EVENT = /^[a-z][a-z0-9_.]{0,79}$/;
const PROPERTY_KEY = /^[a-z][a-z0-9_]{0,63}$/;

export function isEventCatalogRange(
  value: unknown,
): value is EventCatalogRange {
  return value === "24h" || value === "7d" || value === "30d";
}

export function parseEventCatalogStaleDays(
  value: unknown,
): EventCatalogStaleDays | null {
  const number = Number(value);
  return (EVENT_CATALOG_STALE_DAYS as readonly number[]).includes(number)
    ? (number as EventCatalogStaleDays)
    : null;
}

function cleanText(value: unknown, max: number) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;
  // Strip control characters except newlines and tabs.
  const text = [...value]
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code === 9 || code === 10 || (code >= 32 && code !== 127);
    })
    .join("")
    .trim();
  return text.length > max ? null : text;
}

export function parseEventCatalogInput(
  body: unknown,
): { ok: true; data: EventCatalogInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body))
    return { ok: false, error: "Expected a JSON object" };
  const input = body as Record<string, unknown>;
  if (typeof input.project !== "string" || !PROJECT.test(input.project))
    return { ok: false, error: "A valid project is required" };
  if (typeof input.name !== "string" || !EVENT.test(input.name))
    return { ok: false, error: "A valid event name is required" };
  const description = cleanText(
    input.description,
    EVENT_CATALOG_DESCRIPTION_MAX,
  );
  if (description === null)
    return {
      ok: false,
      error: `Description must be text of at most ${EVENT_CATALOG_DESCRIPTION_MAX} characters`,
    };
  const notes = cleanText(input.notes, EVENT_CATALOG_NOTES_MAX);
  if (notes === null)
    return {
      ok: false,
      error: `Owner / notes must be text of at most ${EVENT_CATALOG_NOTES_MAX} characters`,
    };
  for (const flag of ["deprecated", "hidden"] as const)
    if (input[flag] !== undefined && typeof input[flag] !== "boolean")
      return { ok: false, error: `${flag} must be true or false` };
  return {
    ok: true,
    data: {
      project: input.project,
      name: input.name,
      description,
      notes,
      deprecated: input.deprecated === true,
      hidden: input.hidden === true,
    },
  };
}

/** Window bounds: current is [start, end], previous is [previousStart, start). */
export function eventCatalogWindow(range: EventCatalogRange, now: Date) {
  const { buckets, bucketMs } = EVENT_CATALOG_RANGES[range];
  const span = buckets * bucketMs;
  const end = now.getTime();
  return {
    buckets,
    bucketMs,
    end: new Date(end).toISOString(),
    start: new Date(end - span).toISOString(),
    previousStart: new Date(end - 2 * span).toISOString(),
  };
}

/** Bucket of an event in the current window, clamping `end` into the last. */
export function eventCatalogBucket(
  occurredAt: number,
  start: number,
  bucketMs: number,
  buckets: number,
) {
  return Math.min(buckets - 1, Math.floor((occurredAt - start) / bucketMs));
}

// ---------------------------------------------------------------------------
// Likely duplicates and typos. Hints only: Logly never merges or renames.

function compact(name: string) {
  return name.replace(/[_.]/g, "");
}

function wordKey(name: string) {
  return name.split(/[_.]+/).filter(Boolean).sort().join("_");
}

/** Optimal-string-alignment distance, stopping early above `limit`. */
function editDistance(left: string, right: string, limit: number) {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= left.length; i++) {
    const row = [i];
    for (let j = 1; j <= right.length; j++) {
      if (i === 0) {
        row.push(j);
        continue;
      }
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      let value = Math.min(
        (rows[i - 1]?.[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + 1,
        (rows[i - 1]?.[j - 1] ?? 0) + cost,
      );
      if (
        i > 1 &&
        j > 1 &&
        left[i - 1] === right[j - 2] &&
        left[i - 2] === right[j - 1]
      )
        value = Math.min(value, (rows[i - 2]?.[j - 2] ?? 0) + 1);
      row.push(value);
    }
    rows.push(row);
    if (i > 0 && Math.min(...row) > limit) return limit + 1;
  }
  return rows[left.length]?.[right.length] ?? limit + 1;
}

const SUFFIXES = ["s", "es", "d", "ed", "ing", "e"];

/** Why two names look like the same event, or null when they do not. */
export function similarEventReason(
  left: string,
  right: string,
): EventCatalogSimilarReason | null {
  if (left === right) return null;
  const a = compact(left);
  const b = compact(right);
  if (a === b) return "separators";
  if (wordKey(left) === wordKey(right)) return "word_order";
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (
    short.length >= 4 &&
    long.startsWith(short) &&
    SUFFIXES.includes(long.slice(short.length))
  )
    return "suffix";
  // Names that differ only in digits (step_1 / step_2) are deliberate.
  if (a.replace(/[0-9]/g, "") === b.replace(/[0-9]/g, "")) return null;
  if (short.length >= 5 && editDistance(a, b, 1) <= 1) return "typo";
  return null;
}

/** Likely duplicates for each name, among `names`. O(n²) for n ≤ 1,500. */
export function findSimilarEventNames(names: string[]) {
  const result = new Map<string, EventCatalogSimilar[]>();
  const unique = [...new Set(names)].sort();
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const left = unique[i] as string;
      const right = unique[j] as string;
      const reason = similarEventReason(left, right);
      if (!reason) continue;
      result.set(left, [...(result.get(left) ?? []), { name: right, reason }]);
      result.set(right, [...(result.get(right) ?? []), { name: left, reason }]);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Assembly shared by the SQL path and the in-memory specification.

export type EventCatalogStats = {
  name: string;
  firstSeen: string | null;
  lastSeen: string | null;
  count: number;
  previousCount: number;
  trend: number[];
  sources: EventCatalogSource[];
  properties: string[];
};

export function sortEventCatalogSources(sources: Iterable<string>) {
  const set = new Set(sources);
  return SOURCE_ORDER.filter((source) => set.has(source));
}

export function cleanEventPropertyKeys(keys: Iterable<string>) {
  return [...new Set(keys)]
    .filter((key) => PROPERTY_KEY.test(key))
    .sort()
    .slice(0, 50);
}

function emptyMetadata(name: string): EventCatalogMetadata {
  return {
    name,
    description: "",
    notes: "",
    deprecated: false,
    hidden: false,
    updatedAt: null,
  };
}

/**
 * Joins stats and metadata into the catalog. Names come from both: an event
 * with metadata stays listed after its data ages out. Ordered by range
 * volume, then most recently seen, then name.
 */
export function buildEventCatalog(input: {
  query: EventCatalogQuery;
  now: Date;
  stats: EventCatalogStats[];
  metadata: EventCatalogMetadata[];
  truncated: boolean;
}): AnalyticsEventCatalog {
  const window = eventCatalogWindow(input.query.range, input.now);
  const staleBefore = input.now.getTime() - input.query.staleDays * 86_400_000;
  const stats = new Map(input.stats.map((row) => [row.name, row]));
  const metadata = new Map(input.metadata.map((row) => [row.name, row]));
  const names = [...new Set([...stats.keys(), ...metadata.keys()])];
  const similar = findSimilarEventNames(names);
  const events = names.map((name): EventCatalogEntry => {
    const row = stats.get(name);
    const lastSeen = row?.lastSeen ?? null;
    return {
      ...(metadata.get(name) ?? emptyMetadata(name)),
      firstSeen: row?.firstSeen ?? null,
      lastSeen,
      count: row?.count ?? 0,
      previousCount: row?.previousCount ?? 0,
      trend: row?.trend ?? Array.from({ length: window.buckets }, () => 0),
      sources: row?.sources ?? [],
      properties: row?.properties ?? [],
      status:
        lastSeen && Date.parse(lastSeen) >= staleBefore ? "active" : "stale",
      similar: similar.get(name) ?? [],
    };
  });
  events.sort(
    (left, right) =>
      right.count - left.count ||
      (right.lastSeen ?? "").localeCompare(left.lastSeen ?? "") ||
      left.name.localeCompare(right.name),
  );
  return {
    project: input.query.project,
    range: input.query.range,
    staleDays: input.query.staleDays,
    start: window.start,
    end: window.end,
    bucketMs: window.bucketMs,
    events,
    truncated: input.truncated,
  };
}

/** In-memory specification (and demo-mode implementation) of the catalog. */
export function summarizeEventCatalog(
  allEvents: AnalyticsEventRow[],
  query: EventCatalogQuery,
  metadata: EventCatalogMetadata[] = [],
  now = new Date(),
): AnalyticsEventCatalog {
  const window = eventCatalogWindow(query.range, now);
  const start = Date.parse(window.start);
  const previousStart = Date.parse(window.previousStart);
  const end = now.getTime();
  const byName = new Map<string, AnalyticsEventRow[]>();
  for (const event of allEvents) {
    if (event.project !== query.project) continue;
    const list = byName.get(event.name) ?? [];
    list.push(event);
    byName.set(event.name, list);
  }
  const names = [...byName.keys()].sort();
  const kept = names.slice(0, EVENT_CATALOG_MAX_EVENTS);
  const stats = kept.map((name): EventCatalogStats => {
    const events = [...(byName.get(name) ?? [])].sort(
      (left, right) =>
        right.occurredAt.localeCompare(left.occurredAt) ||
        right.id.localeCompare(left.id),
    );
    const trend = Array.from({ length: window.buckets }, () => 0);
    let count = 0;
    let previousCount = 0;
    for (const event of events) {
      const at = Date.parse(event.occurredAt);
      if (at >= start && at <= end) {
        count++;
        const bucket = eventCatalogBucket(
          at,
          start,
          window.bucketMs,
          window.buckets,
        );
        trend[bucket] = (trend[bucket] ?? 0) + 1;
      } else if (at >= previousStart && at < start) previousCount++;
    }
    const sample = events.slice(0, EVENT_CATALOG_SAMPLE_PER_NAME);
    return {
      name,
      firstSeen: events.at(-1)?.occurredAt ?? null,
      lastSeen: events[0]?.occurredAt ?? null,
      count,
      previousCount,
      trend,
      sources: sortEventCatalogSources(sample.map((event) => event.source)),
      properties: cleanEventPropertyKeys(
        sample.flatMap((event) => Object.keys(event.properties ?? {})),
      ),
    };
  });
  return buildEventCatalog({
    query,
    now,
    stats,
    metadata,
    truncated: names.length > EVENT_CATALOG_MAX_EVENTS,
  });
}

/** Applies catalog flags to a picker's names: hidden dropped, kept selected. */
export function visibleEventNames(
  names: string[],
  flags: EventCatalogFlags | undefined,
  keep: Array<string | null | undefined> = [],
) {
  if (!flags?.hidden.length) return names;
  const hidden = new Set(flags.hidden);
  return names.filter((name) => !hidden.has(name) || keep.includes(name));
}
