// SQL fixture tests for the Pages report and tracking-quiet alerts. Like the
// breakdown fixture, they run only against a disposable local PostgreSQL
// database (host local, name ending in "_test") named by
// LOGLY_SQL_TEST_DATABASE_URL or LOGLY_BREAKDOWN_TEST_DATABASE_URL. Each run
// applies every Drizzle migration into a fresh schema and drops it afterwards.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type AnalyticsEventRow, summarizePages } from "@logly/utils";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema";
import { getDashboardPages } from "./pages";
import {
  evaluateTrackingAlerts,
  getTrackingAlertsReport,
  listTrackingAlertStates,
} from "./tracking-alerts";

const url =
  process.env.LOGLY_SQL_TEST_DATABASE_URL ??
  process.env.LOGLY_BREAKDOWN_TEST_DATABASE_URL;
const target = url ? new URL(url) : null;
const runnable = Boolean(
  target &&
    ["127.0.0.1", "localhost"].includes(target.hostname) &&
    target.pathname.endsWith("_test"),
);
const schemaName = `pages_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
let client: ReturnType<typeof postgres> | undefined;
let db: ReturnType<typeof drizzle<typeof schema>>;
const projects: Record<string, string> = {};

const now = new Date("2026-11-24T12:00:00Z");
const pageEvents: Array<[string | null, string | null, string, string?]> = [
  ["/", "a", "2026-11-24T08:00:00Z"],
  ["/orders/:id", "a", "2026-11-24T08:05:00Z"],
  ["/orders/:id", "a", "2026-11-24T08:10:00Z"],
  ["/", "b", "2026-11-24T09:00:00Z"],
  ["/other", "b", "2026-11-24T09:01:00Z"],
  ["/orders/123", "c", "2026-11-24T10:00:00Z"],
  [null, "c", "2026-11-24T10:01:00Z"],
  ["/", "a", "2026-11-23T08:00:00Z"],
  ["/orders/:id", "d", "2026-11-23T09:00:00Z"],
  ["/", "z", "2026-11-20T08:00:00Z"],
  ["Home", "m", "2026-11-24T07:00:00Z", "screen_view"],
];

describe.skipIf(!runnable)("pages and tracking alerts SQL", () => {
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
      await client`insert into analytics_organizations (slug, name) values ('pg-org', 'PG') returning id`;
    for (const slug of ["pg-web", "pg-busy", "pg-small", "pg-other"]) {
      const [row] =
        await client`insert into analytics_projects (organization_id, slug, name) values (${org?.id}, ${slug}, ${slug}) returning id`;
      projects[slug] = row?.id;
    }
    for (const [route, visitor, at, name] of pageEvents) {
      await client`insert into analytics_events
        (project_id, event_id, name, source, occurred_at, visitor_key, route)
        values (${projects["pg-web"] ?? null}, gen_random_uuid(), ${name ?? "page_view"},
          ${name ? "mobile" : "browser"}, ${at}, ${visitor}, ${route})`;
    }
    // Other project's page view must not leak into pg-web.
    await client`insert into analytics_events (project_id, event_id, name, source, occurred_at, visitor_key, route)
      values (${projects["pg-other"] ?? null}, gen_random_uuid(), 'page_view', 'browser', '2026-11-24T08:00:00Z', 'x', '/')`;
    // Tracking volume: pg-busy has 40 events in 09:00–11:50 on each of the
    // previous 7 days but none today; pg-small only 5 per day.
    for (let day = 1; day <= 7; day++) {
      const base = Date.parse("2026-11-24T09:30:00Z") - day * 86_400_000;
      await client`insert into analytics_events (project_id, event_id, name, source, occurred_at)
        select ${projects["pg-busy"] ?? null}, gen_random_uuid(), 'tick', 'server',
          ${new Date(base).toISOString()}::timestamptz + (n || ' minutes')::interval
        from generate_series(1, 40) n`;
      await client`insert into analytics_events (project_id, event_id, name, source, occurred_at)
        select ${projects["pg-small"] ?? null}, gen_random_uuid(), 'tick', 'server',
          ${new Date(base).toISOString()}::timestamptz + (n || ' minutes')::interval
        from generate_series(1, 5) n`;
    }
  });

  afterAll(async () => {
    if (client) {
      await client.unsafe(`drop schema if exists "${schemaName}" cascade`);
      await client.end();
    }
  });

  test("SQL pages report matches the in-memory specification", async () => {
    const report = await getDashboardPages(
      { project: "pg-web", organization: "pg-org", range: "24h", now },
      db,
    );
    const rows: AnalyticsEventRow[] = pageEvents.map(
      ([route, visitor, at, name], index) => ({
        id: String(index),
        name: name ?? "page_view",
        project: "pg-web",
        source: "browser",
        visitorKey: visitor,
        visitKind: null,
        route,
        referrerHost: null,
        occurredAt: new Date(at).toISOString(),
        properties: {},
      }),
    );
    const expected = summarizePages(rows, {
      project: "pg-web",
      range: "24h",
      now,
    });
    expect(report.totals).toEqual(expected.totals);
    expect(report.available).toEqual({ page_view: 7, screen_view: 1 });
    const byRoute = (list: Array<{ route: string | null }>) =>
      [...list].sort((a, b) => String(a.route).localeCompare(String(b.route)));
    expect(byRoute(report.pages)).toEqual(byRoute(expected.pages));
    expect(byRoute(report.entries)).toEqual(byRoute(expected.entries));
    expect(byRoute(report.exits)).toEqual(byRoute(expected.exits));
  });

  test("SQL pages report serves screen_view", async () => {
    const report = await getDashboardPages(
      { project: "pg-web", range: "24h", view: "screen_view", now },
      db,
    );
    expect(report.view).toBe("screen_view");
    expect(report.pages.map((page) => page.route)).toEqual(["Home"]);
  });

  test("opens, throttles, and resolves a tracking-quiet alert", async () => {
    const first = await evaluateTrackingAlerts(now, db);
    expect(first.evaluated).toBe(4);
    // A second read within five minutes claims nothing.
    expect((await evaluateTrackingAlerts(now, db)).evaluated).toBe(0);

    const states = await listTrackingAlertStates(Object.values(projects), db);
    expect(states.get(projects["pg-busy"] ?? "")).toMatchObject({
      status: "stopped",
      observedEvents: 0,
      baselineEvents: 40,
      openedAt: now.toISOString(),
    });
    expect(states.get(projects["pg-small"] ?? "")?.status).toBe("low_volume");
    expect(states.get(projects["pg-small"] ?? "")?.openedAt).toBeNull();

    // Traffic recovers; the next evaluation after the interval resolves it.
    const sqlClient = client as ReturnType<typeof postgres>;
    await sqlClient`insert into analytics_events (project_id, event_id, name, source, occurred_at)
      select ${projects["pg-busy"] ?? null}, gen_random_uuid(), 'tick', 'server',
        '2026-11-24T10:00:00Z'::timestamptz + (n || ' seconds')::interval
      from generate_series(1, 30) n`;
    const later = new Date(now.getTime() + 6 * 60_000);
    expect((await evaluateTrackingAlerts(later, db)).evaluated).toBe(4);
    const report = await getTrackingAlertsReport({ project: "pg-busy" }, db);
    expect(report?.state.status).toBe("ok");
    expect(report?.history).toEqual([
      expect.objectContaining({
        severity: "stopped",
        openedAt: now.toISOString(),
        resolvedAt: later.toISOString(),
        baselineEvents: 40,
      }),
    ]);
  });
});
