// SQL fixture test for the app-version adoption report. Runs only against a
// disposable local PostgreSQL database (host local, name ending in "_test")
// named by LOGLY_SQL_TEST_DATABASE_URL or LOGLY_BREAKDOWN_TEST_DATABASE_URL.
// Each run applies every Drizzle migration into a fresh schema and drops it.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type AnalyticsEventRow, summarizeAppVersions } from "@logly/utils";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema";
import { getDashboardAppVersions } from "./app-versions";

const url =
  process.env.LOGLY_SQL_TEST_DATABASE_URL ??
  process.env.LOGLY_BREAKDOWN_TEST_DATABASE_URL;
const target = url ? new URL(url) : null;
const runnable = Boolean(
  target &&
    ["127.0.0.1", "localhost"].includes(target.hostname) &&
    target.pathname.endsWith("_test"),
);
const schemaName = `appver_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
let client: ReturnType<typeof postgres> | undefined;
let db: ReturnType<typeof drizzle<typeof schema>>;

const now = new Date("2026-11-24T12:00:00Z");
// [visitor, platform, version, build, occurredAt, source?]
const rows: Array<
  [string | null, string | null, string | null, string | null, string, string?]
> = [
  ["a", "android", "1.9.0", "90", "2026-11-20T01:00:00Z"],
  ["a", "android", "1.10.0", "100", "2026-11-23T05:00:00Z"],
  ["b", "ios", "1.9.0", "77", "2026-11-22T06:00:00Z"],
  ["b", "ios", "1.9.0", "78", "2026-11-24T06:00:00Z"],
  ["c", "android", null, null, "2026-11-21T07:00:00Z"],
  ["d", "android", " ", null, "2026-11-24T08:00:00Z"],
  [null, "android", "1.10.0", "100", "2026-11-24T09:00:00Z"],
  ["e", "ios", "1.10.0-beta.2", "99", "2026-11-19T09:00:00Z"],
  ["z", "android", "1.8.0", "80", "2026-09-30T00:00:00Z"],
  ["z", "android", "1.9.0", "90", "2026-10-01T00:00:00Z"],
  ["w", "web", null, null, "2026-11-24T09:00:00Z", "browser"],
];

describe.skipIf(!runnable)("app versions SQL", () => {
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
      await client`insert into analytics_organizations (slug, name) values ('av-org', 'AV') returning id`;
    const ids: Record<string, string> = {};
    for (const slug of ["av-app", "av-web"]) {
      const [row] =
        await client`insert into analytics_projects (organization_id, slug, name) values (${org?.id}, ${slug}, ${slug}) returning id`;
      ids[slug] = row?.id;
    }
    for (const [visitor, platform, version, build, at, source] of rows) {
      await client`insert into analytics_events
        (project_id, event_id, name, source, platform, app_version, app_build, occurred_at, visitor_key)
        values (${source ? (ids["av-web"] ?? null) : (ids["av-app"] ?? null)}, gen_random_uuid(), 'app_session',
          ${source ?? "mobile"}, ${platform}, ${version}, ${build}, ${at}, ${visitor})`;
    }
  });

  afterAll(async () => {
    await client?.unsafe(`drop schema if exists "${schemaName}" cascade`);
    await client?.end();
  });

  test("matches the in-memory specification", async () => {
    const memory: AnalyticsEventRow[] = rows
      .filter((row) => !row[5])
      .map(([visitor, platform, version, build, at], index) => ({
        id: `e${String(index).padStart(3, "0")}`,
        name: "app_session",
        project: "av-app",
        source: "mobile",
        platform: platform as "ios" | "android",
        appVersion: version,
        appBuild: build,
        visitorKey: visitor,
        visitKind: null,
        route: null,
        referrerHost: null,
        occurredAt: at,
        properties: {},
      }));
    for (const range of ["24h", "7d", "30d"] as const) {
      const sqlReport = await getDashboardAppVersions(
        { project: "av-app", organization: "av-org", range, now },
        db as never,
      );
      expect(sqlReport).toEqual(
        summarizeAppVersions(memory, { project: "av-app", range, now }),
      );
    }
    const week = await getDashboardAppVersions(
      { project: "av-app", range: "7d", now },
      db as never,
    );
    expect(
      week.versions.map((row) => [
        row.label,
        row.activeUsers,
        row.currentUsers,
      ]),
    ).toEqual([
      ["1.10.0", 1, 1],
      ["1.10.0-beta.2", 1, 1],
      ["1.9.0", 2, 1],
      ["Unknown", 2, 2],
    ]);
    expect(week.versions[2]?.firstSeen).toBe("2026-10-01T00:00:00.000Z");
    expect(week.versions[2]?.builds).toEqual([{ build: "78", users: 1 }]);
  });

  test("web-only projects report mobile: false", async () => {
    const report = await getDashboardAppVersions(
      { project: "av-web", range: "30d", now },
      db as never,
    );
    expect(report.mobile).toBe(false);
    expect(report.totals.activeUsers).toBe(0);
  });
});
