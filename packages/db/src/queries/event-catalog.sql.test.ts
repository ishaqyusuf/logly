// SQL fixture test for the event catalog. Runs only against a disposable
// local PostgreSQL database (host local, name ending in "_test") named by
// LOGLY_SQL_TEST_DATABASE_URL or LOGLY_BREAKDOWN_TEST_DATABASE_URL. Each run
// applies every Drizzle migration into a fresh schema and drops it.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type AnalyticsEventRow,
  EVENT_CATALOG_MAX_METADATA,
  type EventCatalogMetadata,
  type EventCatalogRange,
  type EventCatalogStaleDays,
  summarizeEventCatalog,
} from "@logly/utils";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema";
import {
  getEventCatalog,
  getEventCatalogFlags,
  saveEventCatalogMetadata,
} from "./event-catalog";
import { getFunnelOptions } from "./funnel";

const url =
  process.env.LOGLY_SQL_TEST_DATABASE_URL ??
  process.env.LOGLY_BREAKDOWN_TEST_DATABASE_URL;
const target = url ? new URL(url) : null;
const runnable = Boolean(
  target &&
    ["127.0.0.1", "localhost"].includes(target.hostname) &&
    target.pathname.endsWith("_test"),
);
const schemaName = `catalog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
let client: ReturnType<typeof postgres> | undefined;
let db: ReturnType<typeof drizzle<typeof schema>>;

function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

// "now" is real time so funnel options (last 30 days) see the same data.
const now = new Date(Math.floor(Date.now() / 1000) * 1000);
const names = [
  "quote_opened",
  "quoteopened",
  "quote_open",
  "page_view",
  "site_visit",
  "job_opened",
  "legacy_signup",
  "notification_opened",
];
// Days back each name may reach; legacy_signup is old only (stale).
const reach: Record<string, [number, number]> = {
  quote_opened: [0, 70],
  quoteopened: [0, 3],
  quote_open: [20, 45],
  page_view: [0, 65],
  site_visit: [0, 65],
  job_opened: [0, 12],
  legacy_signup: [40, 120],
  notification_opened: [0, 2],
};
const sources = ["browser", "mobile", "server"] as const;
const events: AnalyticsEventRow[] = [];
const next = random(7);
let tick = 0;
for (const name of names) {
  const [from, to] = reach[name] ?? [0, 1];
  const count = name === "page_view" ? 900 : 20 + Math.floor(next() * 160);
  for (let index = 0; index < count; index++) {
    tick++;
    const daysAgo = from + next() * (to - from);
    // Unique whole milliseconds; a few land exactly on bucket edges.
    const at =
      index === 0
        ? now.getTime() - 86_400_000 * (from + 1)
        : now.getTime() - Math.floor(daysAgo * 86_400_000) - tick;
    const source =
      name === "page_view" && index % 3 !== 0
        ? "browser"
        : (sources[Math.floor(next() * 3)] ?? "browser");
    events.push({
      id: `e${String(tick).padStart(6, "0")}`,
      name,
      project: "cat-app",
      source,
      visitorKey: `v${Math.floor(next() * 50)}`,
      visitKind: null,
      route: null,
      referrerHost: null,
      occurredAt: new Date(at).toISOString(),
      properties:
        next() < 0.4
          ? { channel: "email", [`k_${name.length}`]: 1 }
          : next() < 0.1
            ? { "Bad Key": 1 }
            : {},
    });
  }
}
// The window end itself.
events.push({
  ...(events[0] as AnalyticsEventRow),
  id: "e999998",
  occurredAt: now.toISOString(),
});

describe.skipIf(!runnable)("event catalog SQL", () => {
  beforeAll(async () => {
    client = postgres(url ?? "", {
      max: 1,
      prepare: false,
      onnotice: () => {},
      connection: { search_path: schemaName },
    });
    db = drizzle(client, { schema });
    await client.unsafe(`create schema "${schemaName}"`);
    const dir = join(import.meta.dir, "../../drizzle");
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const text = readFileSync(join(dir, file), "utf8").replaceAll(
        '"public".',
        `"${schemaName}".`,
      );
      for (const statement of text.split("--> statement-breakpoint"))
        if (statement.trim()) await client.unsafe(statement);
    }
    const [org] =
      await client`insert into analytics_organizations (slug, name) values ('cat-org', 'Cat') returning id`;
    const ids: Record<string, string> = {};
    for (const slug of ["cat-app", "cat-other"]) {
      const [row] =
        await client`insert into analytics_projects (organization_id, slug, name) values (${org?.id}, ${slug}, ${slug}) returning id`;
      ids[slug] = row?.id;
    }
    const rows = events.map((event) => ({
      project_id: ids["cat-app"],
      event_id: crypto.randomUUID(),
      name: event.name,
      source: event.source,
      occurred_at: event.occurredAt,
      visitor_key: event.visitorKey,
      properties: JSON.stringify(event.properties),
    }));
    // Another project's names never leak into this catalog.
    rows.push({
      ...(rows[0] as (typeof rows)[number]),
      project_id: ids["cat-other"],
      event_id: crypto.randomUUID(),
      name: "other_only",
    });
    for (let index = 0; index < rows.length; index += 500)
      await client`insert into analytics_events ${client(rows.slice(index, index + 500))}`;
    await client`update analytics_events set properties = (properties #>> '{}')::jsonb where jsonb_typeof(properties) = 'string'`;
  });

  afterAll(async () => {
    await client?.unsafe(`drop schema if exists "${schemaName}" cascade`);
    await client?.end();
  });

  const cases: Array<[EventCatalogRange, EventCatalogStaleDays]> = [
    ["24h", 7],
    ["7d", 14],
    ["30d", 30],
    ["30d", 90],
  ];
  for (const [range, staleDays] of cases)
    test(`matches the in-memory spec (${range}, stale ${staleDays}d)`, async () => {
      const query = { project: "cat-app", range, staleDays };
      const actual = await getEventCatalog(query, db as never, now);
      const expected = summarizeEventCatalog(events, query, [], now);
      expect(actual).toEqual(expected);
      expect(actual.events.map((row) => row.name)).not.toContain("other_only");
    });

  test("wrong organization returns an empty catalog", async () => {
    const actual = await getEventCatalog(
      {
        project: "cat-app",
        organization: "nope",
        range: "7d",
        staleDays: 14,
      },
      db as never,
      now,
    );
    expect(actual.events).toEqual([]);
  });

  test("metadata saves, joins the catalog and drives picker flags", async () => {
    const saved = await saveEventCatalogMetadata(
      {
        project: "cat-app",
        name: "quote_open",
        description: "Old name for quote_opened",
        notes: "Owner: sales",
        deprecated: true,
        hidden: true,
      },
      db as never,
    );
    expect(saved.status).toBe("saved");
    // Upsert replaces, never duplicates.
    await saveEventCatalogMetadata(
      {
        project: "cat-app",
        name: "quoteopened",
        description: "",
        notes: "",
        deprecated: true,
        hidden: false,
      },
      db as never,
    );
    await saveEventCatalogMetadata(
      {
        project: "cat-app",
        name: "quoteopened",
        description: "Typo of quote_opened",
        notes: "",
        deprecated: true,
        hidden: false,
      },
      db as never,
    );
    // Metadata for a name with no events stays listed.
    await saveEventCatalogMetadata(
      {
        project: "cat-app",
        name: "planned_event",
        description: "Not shipped yet",
        notes: "",
        deprecated: false,
        hidden: false,
      },
      db as never,
    );
    expect(
      (
        await saveEventCatalogMetadata(
          {
            project: "missing",
            name: "x_event",
            description: "",
            notes: "",
            deprecated: false,
            hidden: false,
          },
          db as never,
        )
      ).status,
    ).toBe("project_not_found");

    const metadataRows = await client?.unsafe(
      `select count(*)::int as n from analytics_event_catalog`,
    );
    expect(metadataRows?.[0]?.n).toBe(3);

    const query = {
      project: "cat-app",
      range: "7d" as const,
      staleDays: 14 as const,
    };
    const actual = await getEventCatalog(query, db as never, now);
    const metadata = actual.events
      .filter((row) => row.updatedAt)
      .map(
        (row): EventCatalogMetadata => ({
          name: row.name,
          description: row.description,
          notes: row.notes,
          deprecated: row.deprecated,
          hidden: row.hidden,
          updatedAt: row.updatedAt,
        }),
      );
    expect(metadata.map((row) => row.name).sort()).toEqual([
      "planned_event",
      "quote_open",
      "quoteopened",
    ]);
    expect(actual).toEqual(summarizeEventCatalog(events, query, metadata, now));
    const typo = actual.events.find((row) => row.name === "quoteopened");
    expect(typo).toMatchObject({
      description: "Typo of quote_opened",
      deprecated: true,
      hidden: false,
    });
    expect(typo?.similar).toContainEqual({
      name: "quote_opened",
      reason: "separators",
    });

    expect(await getEventCatalogFlags("cat-app", db as never)).toEqual({
      deprecated: ["quote_open", "quoteopened"],
      hidden: ["quote_open"],
    });
    expect(await getEventCatalogFlags("cat-other", db as never)).toEqual({
      deprecated: [],
      hidden: [],
    });
  });

  test("hidden events drop out of the funnel picker; deprecated are flagged", async () => {
    const options = await getFunnelOptions("cat-app", db as never);
    const picker = options.events.map((event) => event.name);
    expect(picker).not.toContain("quote_open");
    expect(picker).toContain("quote_opened");
    expect(options.hidden).toEqual(["quote_open"]);
    expect(
      options.events.find((event) => event.name === "quoteopened")?.deprecated,
    ).toBe(true);
    expect(
      options.events.find((event) => event.name === "quote_opened")?.deprecated,
    ).toBeUndefined();
    // Property keys come from the shared per-name sample.
    expect(
      options.events.find((event) => event.name === "page_view")?.properties,
    ).toEqual(["channel", "k_9"]);
  });

  test("the metadata limit counts only new names", async () => {
    const [project] =
      await client`select id from analytics_projects where slug = 'cat-other'`;
    await client?.unsafe(
      `insert into analytics_event_catalog (project_id, name)
       select '${project?.id}', 'name_' || g from generate_series(1, ${EVENT_CATALOG_MAX_METADATA}) g`,
    );
    const input = {
      project: "cat-other",
      description: "",
      notes: "",
      deprecated: true,
      hidden: false,
    };
    expect(
      (
        await saveEventCatalogMetadata(
          { ...input, name: "brand_new" },
          db as never,
        )
      ).status,
    ).toBe("limit");
    expect(
      (
        await saveEventCatalogMetadata(
          { ...input, name: "name_1" },
          db as never,
        )
      ).status,
    ).toBe("saved");
  });
});
