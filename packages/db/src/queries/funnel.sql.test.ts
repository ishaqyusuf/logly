// SQL fixture test for funnels and saved funnels. Runs only against a
// disposable local PostgreSQL database (host local, name ending in "_test")
// named by LOGLY_SQL_TEST_DATABASE_URL or LOGLY_BREAKDOWN_TEST_DATABASE_URL.
// Each run applies every Drizzle migration into a fresh schema and drops it.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type AnalyticsEventRow,
  type AnalyticsFunnelQuery,
  FUNNEL_MAX_SAVED_PER_PROJECT,
  summarizeFunnel,
} from "@logly/utils";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema";
import {
  createSavedFunnel,
  deleteSavedFunnel,
  getDashboardFunnel,
  getFunnelOptions,
  listSavedFunnels,
  updateSavedFunnel,
} from "./funnel";

const url =
  process.env.LOGLY_SQL_TEST_DATABASE_URL ??
  process.env.LOGLY_BREAKDOWN_TEST_DATABASE_URL;
const target = url ? new URL(url) : null;
const runnable = Boolean(
  target &&
    ["127.0.0.1", "localhost"].includes(target.hostname) &&
    target.pathname.endsWith("_test"),
);
const schemaName = `funnel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
let client: ReturnType<typeof postgres> | undefined;
let db: ReturnType<typeof drizzle<typeof schema>>;

// Deterministic pseudo-random events: 400 visitors over 10 days, with
// repeats, out-of-order steps, filters, missing identities and other sources.
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}
const base = Date.parse("2026-11-10T00:00:00.000Z");
const names = ["quote_opened", "quote_edited", "quote_accepted", "page_view"];
const routes = ["/quotes/:id", "/orders/:id", null];
const countries = ["NG", "US", "GB", "CA", "DE", "FR", "GH", null];
const platforms = ["web", "ios", "android"] as const;
const sources = ["browser", "mobile", "server"] as const;
const events: AnalyticsEventRow[] = [];
const next = random(42);
let tick = 0;
for (let visitor = 0; visitor < 400; visitor++) {
  const count = 1 + Math.floor(next() * 7);
  let at = base + Math.floor(next() * 10 * 86_400_000);
  for (let index = 0; index < count; index++) {
    // Mostly short gaps, sometimes days; a unique millisecond avoids ties.
    at += Math.floor((next() < 0.8 ? next() * 7_200 : next() * 400_000) * 1000);
    tick++;
    const source = sources[Math.floor(next() * 3)] ?? "browser";
    events.push({
      id: `e${tick}`,
      name: names[Math.floor(next() * names.length)] ?? "page_view",
      project: "fn-app",
      source,
      platform:
        source === "browser" ? "web" : platforms[Math.floor(next() * 3)],
      appVersion: next() < 0.5 ? `1.${Math.floor(next() * 8)}.0` : null,
      appBuild: null,
      country: countries[Math.floor(next() * countries.length)] ?? null,
      visitorKey: next() < 0.03 ? null : `v${visitor}`,
      visitKind: null,
      route: routes[Math.floor(next() * routes.length)] ?? null,
      referrerHost: null,
      occurredAt: new Date(at + tick).toISOString(),
      properties:
        next() < 0.5 ? { channel: next() < 0.5 ? "email" : "sms" } : {},
    });
  }
}

describe.skipIf(!runnable)("funnel SQL", () => {
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
      await client`insert into analytics_organizations (slug, name) values ('fn-org', 'FN') returning id`;
    const ids: Record<string, string> = {};
    for (const slug of ["fn-app", "fn-other"]) {
      const [row] =
        await client`insert into analytics_projects (organization_id, slug, name) values (${org?.id}, ${slug}, ${slug}) returning id`;
      ids[slug] = row?.id;
    }
    const rows = events.map((event) => ({
      project_id: ids["fn-app"],
      event_id: crypto.randomUUID(),
      name: event.name,
      source: event.source,
      platform: event.platform ?? null,
      app_version: event.appVersion ?? null,
      country: event.country ?? null,
      occurred_at: event.occurredAt,
      visitor_key: event.visitorKey,
      route: event.route,
      properties: JSON.stringify(event.properties),
    }));
    // Same visitor keys in another project must never join this funnel.
    rows.push({
      ...(rows[0] as (typeof rows)[number]),
      project_id: ids["fn-other"],
      event_id: crypto.randomUUID(),
      name: "quote_accepted",
    });
    for (let index = 0; index < rows.length; index += 500)
      await client`insert into analytics_events ${client(rows.slice(index, index + 500))}`;
    await client`update analytics_events set properties = (properties #>> '{}')::jsonb where jsonb_typeof(properties) = 'string'`;
  });

  afterAll(async () => {
    await client?.unsafe(`drop schema if exists "${schemaName}" cascade`);
    await client?.end();
  });

  const cases: Array<[string, Partial<AnalyticsFunnelQuery>, number?]> = [
    [
      "three steps, 1 day",
      { steps: ["quote_opened", "quote_edited", "quote_accepted"] },
    ],
    [
      "1 hour window",
      { steps: ["quote_opened", "quote_accepted"], window: "1h" },
    ],
    [
      "repeated and filtered steps, 30 days",
      {
        window: "30d",
        steps: [
          { event: "page_view", route: "/quotes/:id" },
          { event: "quote_opened" },
          { event: "quote_opened" },
          {
            event: "quote_accepted",
            property: { key: "channel", value: "email" },
          },
        ],
      },
    ],
    [
      "breakdown by country",
      {
        steps: ["quote_opened", "quote_edited"],
        window: "7d",
        breakdown: "country",
      },
    ],
    [
      "breakdown by app version",
      {
        steps: ["page_view", "quote_accepted"],
        window: "7d",
        breakdown: "app_version",
      },
    ],
    [
      "breakdown by source",
      { steps: ["quote_edited", "quote_accepted"], breakdown: "source" },
    ],
    [
      "visitor cap",
      { steps: ["quote_opened", "quote_edited"], window: "7d" },
      25,
    ],
  ];
  for (const [label, partial, cap] of cases)
    test(`matches the in-memory specification: ${label}`, async () => {
      const query: AnalyticsFunnelQuery = {
        project: "fn-app",
        organization: "fn-org",
        start: "2026-11-11T00:00:00.000Z",
        end: "2026-11-19T00:00:00.000Z",
        steps: [],
        ...partial,
      };
      const fromSql = await getDashboardFunnel(query, db as never, cap);
      const fromMemory = summarizeFunnel(events, query, cap);
      expect(fromSql).toEqual(fromMemory);
      expect(fromSql.steps[0]?.visitors).toBeGreaterThan(0);
      if (cap) expect(fromSql.capped).toBe(true);
    });

  test("a wrong organization returns an empty funnel", async () => {
    const result = await getDashboardFunnel(
      {
        project: "fn-app",
        organization: "not-this-org",
        steps: ["quote_opened", "quote_edited"],
      },
      db as never,
    );
    expect(result.steps.map((step) => step.visitors)).toEqual([0, 0]);
  });

  test("saves, renames, lists and deletes funnels per project", async () => {
    const steps = [{ event: "quote_opened" }, { event: "quote_accepted" }];
    const created = await createSavedFunnel(
      { project: "fn-app", name: "Quotes", steps, window: "7d" },
      db as never,
    );
    expect(created.status).toBe("saved");
    if (created.status !== "saved") return;
    expect(
      (
        await createSavedFunnel(
          { project: "fn-app", name: "Quotes", steps, window: "1d" },
          db as never,
        )
      ).status,
    ).toBe("duplicate");
    expect(
      (
        await createSavedFunnel(
          { project: "missing", name: "Quotes", steps, window: "1d" },
          db as never,
        )
      ).status,
    ).toBe("project_not_found");
    const other = await createSavedFunnel(
      { project: "fn-app", name: "Accepted", steps, window: "1h" },
      db as never,
    );
    expect(
      (
        await updateSavedFunnel(
          {
            id: created.funnel.id,
            project: "fn-app",
            name: "Accepted",
            steps,
            window: "1d",
          },
          db as never,
        )
      ).status,
    ).toBe("duplicate");
    const updated = await updateSavedFunnel(
      {
        id: created.funnel.id,
        project: "fn-app",
        name: "Quote to accept",
        steps: [...steps, { event: "page_view", route: "/orders/:id" }],
        window: "30d",
      },
      db as never,
    );
    expect(updated).toMatchObject({
      status: "saved",
      funnel: { name: "Quote to accept", window: "30d" },
    });
    expect(
      (
        await updateSavedFunnel(
          {
            id: created.funnel.id,
            project: "fn-other",
            name: "X",
            steps,
            window: "1d",
          },
          db as never,
        )
      ).status,
    ).toBe("not_found");
    expect(
      (await listSavedFunnels("fn-app", db as never)).map((f) => f.name),
    ).toEqual(["Accepted", "Quote to accept"]);
    expect(await listSavedFunnels("fn-other", db as never)).toEqual([]);
    expect(
      await deleteSavedFunnel(
        { project: "fn-other", id: created.funnel.id },
        db as never,
      ),
    ).toBe(false);
    expect(
      await deleteSavedFunnel(
        { project: "fn-app", id: created.funnel.id },
        db as never,
      ),
    ).toBe(true);
    if (other.status === "saved")
      await deleteSavedFunnel(
        { project: "fn-app", id: other.funnel.id },
        db as never,
      );
  });

  test("caps saved funnels per project", async () => {
    const steps = [{ event: "quote_opened" }, { event: "quote_accepted" }];
    for (let index = 0; index < FUNNEL_MAX_SAVED_PER_PROJECT; index++)
      await createSavedFunnel(
        { project: "fn-other", name: `F${index}`, steps, window: "1d" },
        db as never,
      );
    expect(
      (
        await createSavedFunnel(
          { project: "fn-other", name: "One more", steps, window: "1d" },
          db as never,
        )
      ).status,
    ).toBe("limit");
  });

  test("builder options list known events, stored property keys and routes", async () => {
    await client?.unsafe(
      `update analytics_events set occurred_at = now() - interval '1 day'`,
    );
    const options = await getFunnelOptions("fn-app", db as never);
    expect(options.events.map((event) => event.name).sort()).toEqual(
      [...names].sort(),
    );
    expect(
      options.events.find((event) => event.name === "quote_accepted")
        ?.properties,
    ).toEqual(["channel"]);
    expect(options.routes.sort()).toEqual(["/orders/:id", "/quotes/:id"]);
  });
});
