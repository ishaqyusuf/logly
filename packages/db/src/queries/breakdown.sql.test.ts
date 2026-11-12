// SQL fixture tests for the breakdown query. They run against a disposable
// local PostgreSQL database named by LOGLY_BREAKDOWN_TEST_DATABASE_URL (host
// must be local and the database name must end in "_test"). Each run applies
// every Drizzle migration into a fresh schema and drops it afterwards.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type BreakdownResult, parseBreakdownQuery } from "@logly/utils";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { buildBreakdownSql, shapeBreakdownRows } from "./breakdown";

const url = process.env.LOGLY_BREAKDOWN_TEST_DATABASE_URL;
const target = url ? new URL(url) : null;
const runnable = Boolean(
  target &&
    ["127.0.0.1", "localhost"].includes(target.hostname) &&
    target.pathname.endsWith("_test"),
);
const schema = `breakdown_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
let client: ReturnType<typeof postgres> | undefined;

const actor = (n: number) => String(n).repeat(64).slice(0, 64);
const A1 = actor(1);
const A2 = actor(2);
const A3 = actor(3);
const A4 = actor(4);

type Fixture = {
  project?: string;
  name: string;
  at: string;
  source?: string;
  platform?: string | null;
  actor?: string | null;
  business?: string;
  properties?: Record<string, unknown>;
};

const completed = "assistant_turn_completed";
const failed = "assistant_turn_failed";
const fixtures: Fixture[] = [
  // 2026-11-01
  {
    name: completed,
    at: "2026-11-01T08:00:00Z",
    actor: A1,
    business: "b1",
    properties: { assistant_channel: "whatsapp", duration_ms: 100 },
  },
  {
    name: completed,
    at: "2026-11-01T09:00:00Z",
    actor: A2,
    business: "b1",
    properties: { assistant_channel: "whatsapp", duration_ms: 200 },
  },
  {
    name: completed,
    at: "2026-11-01T10:00:00Z",
    actor: A1,
    business: "b2",
    properties: { assistant_channel: "telegram", duration_ms: 300 },
    platform: "android",
    source: "mobile",
  },
  {
    name: failed,
    at: "2026-11-01T23:59:59Z",
    actor: A3,
    business: "b2",
    properties: { assistant_channel: "web", duration_ms: "slow" },
  },
  // 2026-11-02
  {
    name: completed,
    at: "2026-11-02T00:00:00Z",
    actor: A1,
    business: "b1",
    properties: { assistant_channel: "mobile", duration_ms: 400 },
    platform: "ios",
    source: "mobile",
  },
  {
    name: completed,
    at: "2026-11-02T12:00:00Z",
    actor: A4,
    properties: { duration_ms: 500 },
  },
  {
    name: completed,
    at: "2026-11-02T13:00:00Z",
    actor: A4,
    properties: { assistant_channel: null, duration_ms: 600 },
  },
  // 2026-11-03
  {
    name: failed,
    at: "2026-11-03T18:00:00Z",
    actor: A2,
    business: "b1",
    properties: { assistant_channel: "whatsapp" },
  },
  // Outside the half-open window [2026-11-01, 2026-11-04).
  {
    name: completed,
    at: "2026-10-31T23:59:59Z",
    actor: A1,
    business: "b1",
    properties: { assistant_channel: "whatsapp", duration_ms: 1 },
  },
  {
    name: completed,
    at: "2026-11-04T00:00:00Z",
    actor: A1,
    business: "b1",
    properties: { assistant_channel: "whatsapp", duration_ms: 1 },
  },
  // Other projects (same organization and a foreign one) must never leak.
  ...Array.from({ length: 5 }, (_, index) => ({
    project: "bd-sibling",
    name: completed,
    at: "2026-11-01T12:00:00Z",
    actor: actor(5 + index),
    business: `sibling-${index}`,
    properties: { assistant_channel: "whatsapp", duration_ms: 9000 },
  })),
  {
    project: "bd-foreign",
    name: completed,
    at: "2026-11-01T12:00:00Z",
    actor: A1,
    business: "b1",
    properties: { assistant_channel: "whatsapp" },
  },
];

async function breakdown(params: string): Promise<BreakdownResult> {
  if (!client) throw new Error("Database not ready");
  const query = parseBreakdownQuery(
    new URLSearchParams(
      `project=bd-main&start=2026-11-01T00:00:00Z&end=2026-11-04T00:00:00Z&${params}`,
    ),
  );
  const rows = await drizzle(client).execute(buildBreakdownSql(query));
  return shapeBreakdownRows([...rows] as never, query);
}

describe.skipIf(!runnable)("breakdown SQL fixtures", () => {
  beforeAll(async () => {
    client = postgres(url ?? "", {
      max: 1,
      prepare: false,
      onnotice: () => {},
      connection: { search_path: schema },
    });
    await client.unsafe(`create schema "${schema}"`);
    const dir = join(import.meta.dir, "../../drizzle");
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const text = readFileSync(join(dir, file), "utf8").replaceAll(
        '"public".',
        `"${schema}".`,
      );
      for (const statement of text.split("--> statement-breakpoint"))
        if (statement.trim()) await client.unsafe(statement);
    }
    const [mainOrg] =
      await client`insert into analytics_organizations (slug, name) values ('bd-org', 'BD') returning id`;
    const [foreignOrg] =
      await client`insert into analytics_organizations (slug, name) values ('bd-foreign-org', 'BD Foreign') returning id`;
    const projects: Record<string, string> = {};
    for (const [slug, org] of [
      ["bd-main", mainOrg?.id],
      ["bd-sibling", mainOrg?.id],
      ["bd-foreign", foreignOrg?.id],
    ] as const) {
      const [row] =
        await client`insert into analytics_projects (organization_id, slug, name) values (${org}, ${slug}, ${slug}) returning id`;
      projects[slug] = row?.id;
    }
    for (const event of fixtures) {
      const groups = event.business
        ? { business: { key: event.business } }
        : {};
      await client`insert into analytics_events
        (project_id, event_id, name, source, platform, occurred_at, actor_id, groups, properties)
        values (${projects[event.project ?? "bd-main"] ?? null}, gen_random_uuid(), ${event.name},
          ${event.source ?? "server"}, ${event.platform ?? null}, ${event.at}, ${event.actor ?? null},
          ${client.json(groups)}, ${client.json((event.properties ?? {}) as never)})`;
    }
  });

  afterAll(async () => {
    if (client) {
      await client.unsafe(`drop schema if exists "${schema}" cascade`);
      await client.end();
    }
  });

  test("window totals, distinct actors/groups and percentiles", async () => {
    const result = await breakdown(
      "by=name&metrics=events,actors,groups&durationProperty=duration_ms",
    );
    // 8 in-window main-project events; boundaries and other projects excluded.
    expect(result.totals).toEqual({
      events: 8,
      actors: 4,
      groups: 2,
      // Numeric samples 100..600; the string "slow" is not a number.
      duration: { p50: 350, p95: 575, samples: 6 },
    });
    expect(result.buckets.map((b) => [b.dimensions.name, b.events])).toEqual([
      [completed, 6],
      [failed, 2],
    ]);
    expect(result.buckets[1]).toMatchObject({
      actors: 2,
      groups: 2,
      duration: { p50: null, p95: null, samples: 0 },
    });
  });

  test("top-N keeps explicit (none) and folds the rest into (other)", async () => {
    const result = await breakdown(
      "by=property:assistant_channel&metrics=events,actors,groups&limit=2&durationProperty=duration_ms",
    );
    expect(
      result.buckets.map((b) => [
        b.dimensions["property:assistant_channel"],
        b.events,
        b.actors,
        b.groups,
        b.duration?.p50,
      ]),
    ).toEqual([
      ["whatsapp", 3, 2, 1, 150],
      ["(none)", 2, 1, 0, 550], // missing key and JSON null
      ["(other)", 2, 2, 1, 300], // telegram + web
      ["mobile", 1, 1, 1, 400], // ties broken alphabetically
    ]);
    const sum = result.buckets.reduce((total, b) => total + (b.events ?? 0), 0);
    expect(sum).toBe(result.totals.events ?? -1);
  });

  test("two dimensions and nullable platform", async () => {
    const result = await breakdown("by=name,platform");
    expect(result.metrics).toEqual(["events"]);
    expect(result.buckets).toEqual([
      { dimensions: { name: completed, platform: "(none)" }, events: 4 },
      { dimensions: { name: failed, platform: "(none)" }, events: 2 },
      { dimensions: { name: completed, platform: "android" }, events: 1 },
      { dimensions: { name: completed, platform: "ios" }, events: 1 },
    ]);
  });

  test("UTC daily series includes every day, with day totals and buckets", async () => {
    const result = await breakdown(
      "by=name&metrics=events,actors&interval=day",
    );
    expect(
      result.series?.map((point) => [
        point.date,
        point.totals.events,
        point.totals.actors,
        point.buckets.map((b) => [b.dimensions.name, b.events]),
      ]),
    ).toEqual([
      [
        "2026-11-01",
        4,
        3,
        [
          [completed, 3],
          [failed, 1],
        ],
      ],
      ["2026-11-02", 3, 2, [[completed, 3]]],
      ["2026-11-03", 1, 1, [[failed, 1]]],
    ]);
    const empty = await breakdown(
      "by=name&interval=day&names=assistant_turn_failed&sources=mobile",
    );
    expect(empty.totals).toEqual({ events: 0 });
    expect(empty.buckets).toEqual([]);
    expect(empty.series?.map((p) => [p.date, p.totals.events])).toEqual([
      ["2026-11-01", 0],
      ["2026-11-02", 0],
      ["2026-11-03", 0],
    ]);
  });

  test("event-summary style filters narrow the complete window", async () => {
    const totals = async (params: string) =>
      (await breakdown(`by=name&${params}`)).totals.events;
    expect(await totals("names=assistant_turn_failed")).toBe(2);
    expect(await totals("sources=mobile")).toBe(2);
    expect(await totals("platforms=ios,android")).toBe(2);
    expect(await totals(`actor=${A4}`)).toBe(2);
    expect(await totals("groupType=business")).toBe(6);
    expect(await totals("groupType=business&groupKey=b1")).toBe(4);
    expect(
      await totals(
        "propertyKey=assistant_channel&propertyValue=%22whatsapp%22",
      ),
    ).toBe(3);
    expect(await totals("propertyKey=duration_ms&propertyValue=100")).toBe(1);
    expect(await totals("organization=bd-org")).toBe(8);
  });

  test("project and organization isolation", async () => {
    const main = await breakdown("by=name&metrics=events,actors");
    expect(main.totals).toEqual({ events: 8, actors: 4 });
    expect(
      (await breakdown("by=name&organization=bd-foreign-org")).totals,
    ).toEqual({
      events: 0,
    });
    const query = parseBreakdownQuery(
      new URLSearchParams(
        "project=bd-sibling&start=2026-11-01T00:00:00Z&end=2026-11-04T00:00:00Z&by=name&metrics=events,groups",
      ),
    );
    const rows = await drizzle(client as ReturnType<typeof postgres>).execute(
      buildBreakdownSql(query),
    );
    expect(shapeBreakdownRows([...rows] as never, query).totals).toEqual({
      events: 5,
      groups: 5,
    });
    const missing = parseBreakdownQuery(
      new URLSearchParams(
        "project=bd-missing&start=2026-11-01T00:00:00Z&end=2026-11-04T00:00:00Z&by=name",
      ),
    );
    const none = await drizzle(client as ReturnType<typeof postgres>).execute(
      buildBreakdownSql(missing),
    );
    expect(shapeBreakdownRows([...none] as never, missing).totals).toEqual({
      events: 0,
    });
  });
});
