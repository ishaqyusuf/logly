// Retention report: the in-memory summarizer is the executable specification,
// and the SQL fixture checks the query against it. The SQL part runs only
// against a disposable local PostgreSQL database (host local, name ending in
// "_test") named by LOGLY_SQL_TEST_DATABASE_URL or
// LOGLY_BREAKDOWN_TEST_DATABASE_URL. Each run applies every Drizzle migration
// into a fresh schema and drops it.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type AnalyticsEventRow,
  type AnalyticsRetentionReport,
  groupReleasesByCohort,
  RETENTION_RANGES,
  RETENTION_SURFACES,
  retentionWindow,
  summarizeRetention,
} from "@logly/utils";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema";
import { getDashboardRetention } from "./retention";

// Tuesday; the current ISO week starts Monday 2026-11-23.
const now = new Date("2026-11-24T12:00:00Z");
// [project, visitor, name, source, occurredAt]
const rows: Array<[string, string | null, string, string, string]> = [
  ["rt-app", "a", "site_visit", "browser", "2026-11-02T10:00:00Z"],
  ["rt-app", "a", "page_view", "browser", "2026-11-10T10:00:00Z"],
  ["rt-app", "a", "site_visit", "browser", "2026-11-17T10:00:00Z"],
  ["rt-app", "a", "signup", "browser", "2026-11-24T09:00:00Z"],
  ["rt-app", "b", "site_visit", "browser", "2026-11-03T10:00:00Z"],
  ["rt-app", "b", "page_view", "browser", "2026-11-03T10:05:00Z"],
  // Seen in the lookback before the first cohort: not new, joins no cohort.
  ["rt-app", "c", "site_visit", "browser", "2026-08-20T10:00:00Z"],
  ["rt-app", "c", "site_visit", "browser", "2026-11-10T10:00:00Z"],
  ["rt-app", "d", "app_session", "mobile", "2026-11-18T10:00:00Z"],
  ["rt-app", "d", "app_session", "mobile", "2026-11-19T10:00:00Z"],
  ["rt-app", "d", "screen_view", "mobile", "2026-11-23T10:00:00Z"],
  ["rt-app", "e", "site_visit", "browser", "2026-11-24T08:00:00Z"],
  ["rt-app", "e", "page_view", "browser", "2026-11-24T10:00:00Z"],
  // No entry event: never joins a cohort.
  ["rt-app", "f", "page_view", "browser", "2026-11-05T10:00:00Z"],
  [
    "rt-app",
    null as unknown as string,
    "site_visit",
    "browser",
    "2026-11-10T10:00:00Z",
  ],
  ["rt-app", "g", "site_visit", "browser", "2026-11-23T23:30:00Z"],
  ["rt-app", "g", "signup", "browser", "2026-11-24T01:00:00Z"],
  // Future event (after now) is ignored.
  ["rt-app", "b", "page_view", "browser", "2026-11-24T13:00:00Z"],
  // Another project with the same visitor key does not leak in.
  ["rt-other", "a", "site_visit", "browser", "2026-11-20T10:00:00Z"],
  ["rt-other", "b", "site_visit", "browser", "2026-11-20T10:00:00Z"],
];

const memory: AnalyticsEventRow[] = rows.map(
  ([project, visitor, name, source, at], index) => ({
    id: `e${String(index).padStart(3, "0")}`,
    name,
    project,
    source: source as AnalyticsEventRow["source"],
    platform: source === "mobile" ? "android" : "web",
    visitorKey: visitor,
    visitKind: null,
    route: null,
    referrerHost: null,
    occurredAt: at,
    properties: {},
  }),
);

const grid = (report: AnalyticsRetentionReport) =>
  report.cohorts.map((cohort) => [
    cohort.start.slice(0, 10),
    cohort.size,
    cohort.cells.map((cell) =>
      cell ? `${cell.users}${cell.status === "partial" ? "*" : ""}` : "-",
    ),
  ]);

describe("retention specification", () => {
  test("windows cap weekly cohorts at 12 and start on Mondays", () => {
    const weeks = retentionWindow("12w", now);
    expect(weeks.cohorts).toBe(12);
    expect(weeks.start.toISOString()).toBe("2026-09-07T00:00:00.000Z");
    expect(retentionWindow("30d", now).start.toISOString()).toBe(
      "2026-10-26T00:00:00.000Z",
    );
    const days = retentionWindow("7d", now);
    expect(days.granularity).toBe("day");
    expect(days.start.toISOString()).toBe("2026-11-18T00:00:00.000Z");
  });

  test("weekly cohorts mark incomplete periods instead of drops", () => {
    const report = summarizeRetention(memory, {
      project: "rt-app",
      range: "30d",
      now,
    });
    expect(report.surfaces).toEqual({ web: true, mobile: true });
    expect(grid(report)).toEqual([
      ["2026-10-26", 0, ["0", "0", "0", "0", "0*"]],
      ["2026-11-02", 2, ["2", "1", "1", "1*", "-"]],
      ["2026-11-09", 0, ["0", "0", "0*", "-", "-"]],
      ["2026-11-16", 1, ["1", "1*", "-", "-", "-"]],
      ["2026-11-23", 2, ["2*", "-", "-", "-", "-"]],
    ]);
    expect(report.cohorts.map((cohort) => cohort.complete)).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
    // Only complete periods average: week 1 has just the Nov 2 cohort.
    expect(report.average.map((point) => point.rate)).toEqual([
      1,
      0.5,
      1 / 2,
      null,
      null,
    ]);
    expect(report.average[0]?.cohortUsers).toBe(3);
    expect(report.totals.users).toBe(5);
  });

  test("daily cohorts, surfaces and a chosen returning event", () => {
    const daily = summarizeRetention(memory, {
      project: "rt-app",
      range: "7d",
      now,
    });
    expect(grid(daily)).toEqual([
      ["2026-11-18", 1, ["1", "1", "0", "0", "0", "1", "0*"]],
      ["2026-11-19", 0, ["0", "0", "0", "0", "0", "0*", "-"]],
      ["2026-11-20", 0, ["0", "0", "0", "0", "0*", "-", "-"]],
      ["2026-11-21", 0, ["0", "0", "0", "0*", "-", "-", "-"]],
      ["2026-11-22", 0, ["0", "0", "0*", "-", "-", "-", "-"]],
      ["2026-11-23", 1, ["1", "1*", "-", "-", "-", "-", "-"]],
      ["2026-11-24", 1, ["1*", "-", "-", "-", "-", "-", "-"]],
    ]);
    const mobile = summarizeRetention(memory, {
      project: "rt-app",
      range: "30d",
      surface: "mobile",
      now,
    });
    expect(mobile.totals.users).toBe(1);
    const web = summarizeRetention(memory, {
      project: "rt-app",
      range: "30d",
      surface: "web",
      now,
    });
    expect(web.totals.users).toBe(4);
    const signup = summarizeRetention(memory, {
      project: "rt-app",
      range: "30d",
      returnEvent: " signup ",
      now,
    });
    expect(signup.returnEvent).toBe("signup");
    expect(grid(signup)[1]).toEqual([
      "2026-11-02",
      2,
      ["2", "0", "0", "1*", "-"],
    ]);
  });

  test("releases group onto the cohort they were deployed in", () => {
    const starts = retentionWindow("30d", now);
    const cohortStarts = [0, 1, 2, 3, 4].map((index) =>
      new Date(starts.start.getTime() + index * 7 * 86_400_000).toISOString(),
    );
    const grouped = groupReleasesByCohort(
      [
        { deployedAt: "2026-11-05T09:00:00Z" },
        { deployedAt: "2026-11-02T00:00:00Z" },
        { deployedAt: "2026-10-01T00:00:00Z" },
      ],
      cohortStarts,
      "week",
    );
    expect([...grouped.keys()]).toEqual(["2026-11-02T00:00:00.000Z"]);
    expect(grouped.get("2026-11-02T00:00:00.000Z")?.[0]?.deployedAt).toBe(
      "2026-11-02T00:00:00Z",
    );
  });
});

const url =
  process.env.LOGLY_SQL_TEST_DATABASE_URL ??
  process.env.LOGLY_BREAKDOWN_TEST_DATABASE_URL;
const target = url ? new URL(url) : null;
const runnable = Boolean(
  target &&
    ["127.0.0.1", "localhost"].includes(target.hostname) &&
    target.pathname.endsWith("_test"),
);
const schemaName = `retention_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
let client: ReturnType<typeof postgres> | undefined;
let db: ReturnType<typeof drizzle<typeof schema>>;

describe.skipIf(!runnable)("retention SQL", () => {
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
      await client`insert into analytics_organizations (slug, name) values ('rt-org', 'RT') returning id`;
    const ids: Record<string, string> = {};
    for (const slug of ["rt-app", "rt-other"]) {
      const [row] =
        await client`insert into analytics_projects (organization_id, slug, name) values (${org?.id}, ${slug}, ${slug}) returning id`;
      ids[slug] = row?.id;
    }
    for (const [project, visitor, name, source, at] of rows) {
      await client`insert into analytics_events
        (project_id, event_id, name, source, platform, occurred_at, visitor_key)
        values (${ids[project] ?? null}, gen_random_uuid(), ${name}, ${source},
          ${source === "mobile" ? "android" : "web"}, ${at}, ${visitor})`;
    }
  });

  afterAll(async () => {
    await client?.unsafe(`drop schema if exists "${schemaName}" cascade`);
    await client?.end();
  });

  test("matches the in-memory specification", async () => {
    for (const range of RETENTION_RANGES) {
      for (const surface of RETENTION_SURFACES) {
        for (const returnEvent of [null, "signup", "screen_view"]) {
          const sqlReport = await getDashboardRetention(
            {
              project: "rt-app",
              organization: "rt-org",
              range,
              surface,
              returnEvent,
              now,
            },
            db as never,
          );
          expect(sqlReport).toEqual(
            summarizeRetention(memory, {
              project: "rt-app",
              range,
              surface,
              returnEvent,
              now,
            }),
          );
        }
      }
    }
  });

  test("an unknown project returns empty cohorts", async () => {
    const report = await getDashboardRetention(
      { project: "missing", range: "30d", now },
      db as never,
    );
    expect(report.totals.users).toBe(0);
    expect(report.surfaces).toEqual({ web: false, mobile: false });
  });
});
